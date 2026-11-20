"""DataUpdateCoordinator for Solar Sky Radar."""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    CONF_ENABLE_BOM_FTP,
    CONF_ENABLE_DEA_HOTSPOTS,
    CONF_FIRMS_MAP_KEY,
    CONF_LATITUDE,
    CONF_LONGITUDE,
    CONF_RADAR_PROVIDER,
    CONF_RADIUS_DEG,
    CONF_SATELLITE_PROVIDER,
    CONF_UPDATE_MINUTES,
    DEFAULT_RADIUS_DEG,
    DEFAULT_UPDATE_MINUTES,
    DOMAIN,
    PROVIDER_AUTO,
)
from .engine import RadarSkyEngine

_LOGGER = logging.getLogger(__name__)


class SolarSkyDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinates periodic satellite, cloud, radar, wind, fire, and solar updates."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry
        cfg = {**entry.data, **entry.options}

        lat = float(cfg.get(CONF_LATITUDE, hass.config.latitude))
        lon = float(cfg.get(CONF_LONGITUDE, hass.config.longitude))
        radius_deg = float(cfg.get(CONF_RADIUS_DEG, DEFAULT_RADIUS_DEG))
        update_minutes = int(cfg.get(CONF_UPDATE_MINUTES, DEFAULT_UPDATE_MINUTES))

        self.engine = RadarSkyEngine(
            lat=lat,
            lon=lon,
            radius_deg=radius_deg,
            satellite_provider=str(cfg.get(CONF_SATELLITE_PROVIDER, PROVIDER_AUTO)),
            radar_provider=str(cfg.get(CONF_RADAR_PROVIDER, PROVIDER_AUTO)),
            firms_map_key=cfg.get(CONF_FIRMS_MAP_KEY),
            enable_dea_hotspots=bool(cfg.get(CONF_ENABLE_DEA_HOTSPOTS, True)),
            enable_bom_ftp=bool(cfg.get(CONF_ENABLE_BOM_FTP, False)),
            poll_public_lightning=False,
        )
        self._unsub_lightning: Any = None

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=max(2, update_minutes)),
        )

    def async_subscribe_lightning_events(self) -> None:
        """Listen to new Home Assistant Blitzortung geo_location state transitions in real time."""

        @callback
        def _on_state_change(event: Event) -> None:
            entity_id = event.data.get("entity_id", "")
            if not entity_id.startswith("geo_location."):
                return
            new_state = event.data.get("new_state")
            if new_state is not None:
                self.engine.lightning.ingest_from_hass_states([new_state])

        # Subscribe via bus listener for any geo_location.* entity added dynamically by Blitzortung
        self._unsub_lightning = self.hass.bus.async_listen("state_changed", _on_state_change)

    def async_unsubscribe_lightning_events(self) -> None:
        if callable(self._unsub_lightning):
            self._unsub_lightning()
            self._unsub_lightning = None

    async def _async_update_data(self) -> dict[str, Any]:
        session = async_get_clientsession(self.hass)
        try:
            all_states = self.hass.states.async_all("geo_location")
            return await self.engine.async_refresh(session, hass_states=all_states)
        except Exception as err:  # noqa: BLE001
            raise UpdateFailed(f"Error refreshing Solar Sky Radar data: {err}") from err
