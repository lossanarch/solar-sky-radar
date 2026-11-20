"""Solar Sky Radar Home Assistant integration setup and Lovelace card registrar."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

from .const import CARD_FILENAME, DOMAIN, STATIC_URL_BASE, VERSION

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.core import HomeAssistant

try:
    from homeassistant.components.frontend import add_extra_js_url
    from homeassistant.components.http import StaticPathConfig
    from homeassistant.const import Platform
    from homeassistant.helpers.event import async_call_later

    from .coordinator import SolarSkyDataUpdateCoordinator
    from .http import async_register_http_views

    PLATFORMS: list[Any] = [Platform.SENSOR]
    HAS_HOMEASSISTANT = True
except ModuleNotFoundError:
    from typing import NamedTuple

    class StaticPathConfig(NamedTuple):  # type: ignore[no-redef]
        url_path: str
        path: str
        cache_headers: bool = False

    def add_extra_js_url(hass: Any, url: str) -> None:  # type: ignore[misc]
        hass.data.setdefault("frontend_extra_module_url", set()).add(url)

    async_call_later = None  # type: ignore[assignment]
    SolarSkyDataUpdateCoordinator = None  # type: ignore[assignment,misc]
    async_register_http_views = None  # type: ignore[assignment]
    PLATFORMS = ["sensor"]
    HAS_HOMEASSISTANT = False

_LOGGER = logging.getLogger(__name__)


def _compute_file_digest(file_path: Path) -> str:
    """Compute an 8-char SHA-256 digest for browser/SW cache-busting."""
    try:
        return hashlib.sha256(file_path.read_bytes()).hexdigest()[:8]
    except OSError:
        return VERSION


async def async_register_lovelace_card(hass: HomeAssistant) -> None:
    """Serve the bundled card JS and idempotently register it as a Lovelace module resource."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("card_registered"):
        return

    www_dir = Path(__file__).parent / "www"
    card_file = www_dir / CARD_FILENAME
    if not www_dir.is_dir() or not card_file.is_file():
        _LOGGER.warning("Bundled Lovelace card missing at %s; skipping frontend registration", card_file)
        return

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL_BASE, str(www_dir), False)]
        )
    except RuntimeError:
        _LOGGER.debug("Static path already registered: %s", STATIC_URL_BASE)

    digest = await hass.async_add_executor_job(_compute_file_digest, card_file)
    base_url = f"{STATIC_URL_BASE}/{CARD_FILENAME}"
    versioned_url = f"{base_url}?v={digest}"

    lovelace = hass.data.get("lovelace")
    mode = getattr(lovelace, "mode", None) or (lovelace.get("mode") if isinstance(lovelace, dict) else None)
    resources = getattr(lovelace, "resources", None) or (
        lovelace.get("resources") if isinstance(lovelace, dict) else None
    )

    if mode == "storage" and resources is not None:

        async def _sync_storage_resource(_now: Any = None) -> None:
            if not getattr(resources, "loaded", True):
                async_call_later(hass, 3.0, _sync_storage_resource)
                return

            existing = [
                item
                for item in resources.async_items()
                if str(item.get("url", "")).partition("?")[0] == base_url
            ]
            if existing:
                primary = existing[0]
                if primary.get("url") != versioned_url:
                    await resources.async_update_item(
                        primary["id"], {"res_type": "module", "url": versioned_url}
                    )
            else:
                await resources.async_create_item({"res_type": "module", "url": versioned_url})

        await _sync_storage_resource()
    else:
        # YAML mode fallback
        add_extra_js_url(hass, versioned_url)

    domain_data["card_registered"] = True


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up domain-wide static paths, Lovelace resource, and HTTP endpoints."""
    hass.data.setdefault(DOMAIN, {"coordinators": {}})
    async_register_http_views(hass)
    await async_register_lovelace_card(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Solar Sky Radar from a ConfigEntry."""
    hass.data.setdefault(DOMAIN, {"coordinators": {}})
    async_register_http_views(hass)
    await async_register_lovelace_card(hass)

    coordinator = SolarSkyDataUpdateCoordinator(hass, entry)
    coordinator.async_subscribe_lightning_events()
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN]["coordinators"][entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Solar Sky Radar ConfigEntry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        coord: SolarSkyDataUpdateCoordinator | None = hass.data[DOMAIN]["coordinators"].pop(
            entry.entry_id, None
        )
        if coord is not None:
            coord.async_unsubscribe_lightning_events()
    return unload_ok


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload entry when options change."""
    await hass.config_entries.async_reload(entry.entry_id)
