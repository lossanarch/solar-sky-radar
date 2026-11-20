"""Authenticated HTTP API endpoints serving manifest, WebP frames, wind grids, and hazards."""

from __future__ import annotations

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import API_BASE, DOMAIN
from .coordinator import SolarSkyDataUpdateCoordinator


def _get_primary_coordinator(hass: HomeAssistant, entry_id: str | None = None) -> SolarSkyDataUpdateCoordinator | None:
    entries: dict[str, SolarSkyDataUpdateCoordinator] = hass.data.get(DOMAIN, {}).get("coordinators", {})
    if not entries:
        return None
    if entry_id and entry_id in entries:
        return entries[entry_id]
    return next(iter(entries.values()))


class SolarSkyManifestView(HomeAssistantView):
    """Return synchronized 2-hour frame manifest and solar cloud analysis."""

    url = f"{API_BASE}/manifest"
    name = f"api:{DOMAIN}:manifest"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry_id = request.query.get("entry_id")
        coord = _get_primary_coordinator(hass, entry_id)
        if coord is None:
            return self.json_message("Solar Sky Radar integration is not configured", status_code=503)
        return self.json(coord.engine.build_manifest(api_base=API_BASE))


class SolarSkyFrameView(HomeAssistantView):
    """Serve cached WebP satellite, cloud mask, solar classification, or radar frames."""

    url = f"{API_BASE}/frame/{{layer}}/{{key}}"
    name = f"api:{DOMAIN}:frame"
    requires_auth = True

    async def get(self, request: web.Request, layer: str, key: str) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        entry_id = request.query.get("entry_id")
        coord = _get_primary_coordinator(hass, entry_id)
        if coord is None:
            raise web.HTTPServiceUnavailable(text="Coordinator unavailable")

        if layer not in ("true_colour", "cloud_mask", "solar_cloud", "radar"):
            raise web.HTTPBadRequest(text="Invalid layer")

        raw = coord.engine.get_frame_bytes(layer, key)
        if raw is None:
            raise web.HTTPNotFound(text="Frame not found")

        return web.Response(
            body=raw,
            content_type="image/webp",
            headers={"Cache-Control": "private, max-age=3600, immutable"},
        )


class SolarSkyWindView(HomeAssistantView):
    """Serve regional 10m surface and 850hPa cloud-steering u/v wind grids."""

    url = f"{API_BASE}/wind"
    name = f"api:{DOMAIN}:wind"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        coord = _get_primary_coordinator(hass, request.query.get("entry_id"))
        if coord is None:
            return self.json_message("Coordinator unavailable", status_code=503)
        snap = coord.engine.wind.current_snapshot
        return self.json(snap.to_api_dict() if snap else {"levels": {}})


class SolarSkyHazardsView(HomeAssistantView):
    """Serve NASA FIRMS / DEA fire hotspots and 2-hour Blitzortung lightning GeoJSON."""

    url = f"{API_BASE}/hazards"
    name = f"api:{DOMAIN}:hazards"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        coord = _get_primary_coordinator(hass, request.query.get("entry_id"))
        if coord is None:
            return self.json_message("Coordinator unavailable", status_code=503)
        return self.json(coord.engine.get_hazards_payload())


def async_register_http_views(hass: HomeAssistant) -> None:
    """Register HTTP views once per Home Assistant runtime."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("views_registered"):
        return
    hass.http.register_view(SolarSkyManifestView())
    hass.http.register_view(SolarSkyFrameView())
    hass.http.register_view(SolarSkyWindView())
    hass.http.register_view(SolarSkyHazardsView())
    domain_data["views_registered"] = True
