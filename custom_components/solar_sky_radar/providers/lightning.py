"""Time-synchronized 2-hour Lightning Strike buffer.

Integrates directly with Home Assistant's `blitzortung` `geo_location` entities
when present, and optionally listens briefly to public Blitzortung WebSocket relays
so historical and live strikes scrub in sync with the 2-hour playback slider.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
from typing import Any

import aiohttp

from ..const import HISTORY_MINUTES
from .geostationary import BoundingBox

_LOGGER = logging.getLogger(__name__)


def lzw_decode_blitzortung(compressed: str) -> str:
    """Decode Blitzortung WebSocket LZW-encoded JSON frame."""
    if not compressed:
        return ""
    if compressed.startswith("{"):
        return compressed
    dict_map: dict[int, str] = {i: chr(i) for i in range(256)}
    chars = list(compressed)
    curr_char = chars[0]
    old_phrase = curr_char
    out = [curr_char]
    code = 256
    for ch in chars[1:]:
        curr_code = ord(ch)
        if curr_code < 256:
            phrase = ch
        elif curr_code in dict_map:
            phrase = dict_map[curr_code]
        else:
            phrase = old_phrase + curr_char
        out.append(phrase)
        curr_char = phrase[0]
        dict_map[code] = old_phrase + curr_char
        code += 1
        old_phrase = phrase
    return "".join(out)


@dataclass
class LightningStrike:
    """Single geolocated lightning discharge."""

    strike_id: str
    lat: float
    lon: float
    epoch: int
    source: str = "blitzortung"

    def to_feature(self, now_epoch: int) -> dict[str, Any]:
        age_min = max(0.0, (now_epoch - self.epoch) / 60.0)
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(self.lon, 5), round(self.lat, 5)]},
            "properties": {
                "id": self.strike_id,
                "epoch": self.epoch,
                "age_minutes": round(age_min, 1),
                "source": self.source,
            },
        }


class LightningStrikeBuffer:
    """Maintains a deduplicated 2-hour window of lightning strikes inside `bbox`."""

    def __init__(self, lat: float, lon: float, radius_deg: float = 3.5) -> None:
        self.lat = lat
        self.lon = lon
        self.bbox = BoundingBox.around(lat, lon, min(8.0, radius_deg + 1.5))
        self._strikes: dict[str, LightningStrike] = {}

    def update_aoi(self, lat: float, lon: float, radius_deg: float = 3.5) -> None:
        self.lat = lat
        self.lon = lon
        self.bbox = BoundingBox.around(lat, lon, min(8.0, radius_deg + 1.5))

    def ingest_strike(self, lat: float, lon: float, epoch: int, source: str = "blitzortung") -> bool:
        if not (self.bbox.south <= lat <= self.bbox.north and self.bbox.west <= lon <= self.bbox.east):
            return False
        strike_id = f"{round(lat, 3)}:{round(lon, 3)}:{epoch // 2}"
        self._strikes[strike_id] = LightningStrike(
            strike_id=strike_id, lat=lat, lon=lon, epoch=epoch, source=source
        )
        return True

    def ingest_from_hass_states(self, states: list[Any], now_epoch: int | None = None) -> int:
        """Collect lightning strikes from Home Assistant `geo_location` Blitzortung entities."""
        now_ts = now_epoch or int(datetime.now(timezone.utc).timestamp())
        added = 0
        for st in states:
            entity_id = getattr(st, "entity_id", "")
            if not entity_id.startswith("geo_location."):
                continue
            attrs = getattr(st, "attributes", {}) or {}
            src = str(attrs.get("source") or attrs.get("attribution") or "").lower()
            if "blitzortung" not in src and "lightning" not in entity_id.lower():
                continue
            lat = attrs.get("latitude")
            lon = attrs.get("longitude")
            if lat is None or lon is None:
                continue
            pub_date = attrs.get("publication_date")
            last_changed = getattr(st, "last_changed", None)
            ep = now_ts
            if isinstance(pub_date, (int, float)):
                ep = int(pub_date if pub_date < 1e11 else pub_date / 1000)
            elif hasattr(last_changed, "timestamp"):
                ep = int(last_changed.timestamp())
            if self.ingest_strike(float(lat), float(lon), ep, source="ha_blitzortung"):
                added += 1
        self.prune(now_ts)
        return added

    async def async_poll_public_blitzortung(self, session: aiohttp.ClientSession, listen_seconds: float = 2.2) -> int:
        """Briefly sample public Blitzortung WebSocket feed when HA Blitzortung is not installed."""
        ws_hosts = [
            "wss://ws1.blitzortung.org/",
            "wss://ws7.blitzortung.org/",
            "wss://ws8.blitzortung.org/",
        ]
        added = 0
        now_ts = int(datetime.now(timezone.utc).timestamp())
        for url in ws_hosts:
            try:
                async with session.ws_connect(
                    url, timeout=aiohttp.ClientClientWSTimeout(ws_close=2.0) if hasattr(aiohttp, "ClientClientWSTimeout") else 3.0
                ) as ws:
                    await ws.send_str('{"a":111}')
                    deadline = datetime.now(timezone.utc).timestamp() + listen_seconds
                    while datetime.now(timezone.utc).timestamp() < deadline:
                        remain = max(0.2, deadline - datetime.now(timezone.utc).timestamp())
                        try:
                            msg = await ws.receive(timeout=remain)
                        except TimeoutError:
                            break
                        if msg.type != aiohttp.WSMsgType.TEXT:
                            break
                        decoded = lzw_decode_blitzortung(msg.data)
                        payload = json.loads(decoded)
                        lat = payload.get("lat")
                        lon = payload.get("lon")
                        t_ns = payload.get("time")
                        if lat is not None and lon is not None:
                            ep = int(t_ns / 1e9) if isinstance(t_ns, (int, float)) and t_ns > 1e14 else now_ts
                            if self.ingest_strike(float(lat), float(lon), ep, source="blitzortung_ws"):
                                added += 1
                    break
            except Exception as err:  # noqa: BLE001
                _LOGGER.debug("Blitzortung WS relay %s skipped: %s", url, err)
                continue

        self.prune(now_ts)
        return added

    def prune(self, now_epoch: int | None = None) -> None:
        now_ts = now_epoch or int(datetime.now(timezone.utc).timestamp())
        cutoff = now_ts - HISTORY_MINUTES * 60
        for sid in [k for k, v in self._strikes.items() if v.epoch < cutoff]:
            del self._strikes[sid]

    def to_geojson(self, now_epoch: int | None = None) -> dict[str, Any]:
        now_ts = now_epoch or int(datetime.now(timezone.utc).timestamp())
        self.prune(now_ts)
        ordered = sorted(self._strikes.values(), key=lambda s: s.epoch)
        return {
            "type": "FeatureCollection",
            "features": [s.to_feature(now_ts) for s in ordered],
            "meta": {
                "count_2h": len(ordered),
                "count_15m": sum(1 for s in ordered if (now_ts - s.epoch) <= 900),
                "updated_epoch": now_ts,
            },
        }
