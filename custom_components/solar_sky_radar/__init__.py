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
    from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
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

    def add_extra_js_url(hass: Any, url: str, es5: bool = False) -> None:  # type: ignore[misc]
        key = "frontend_extra_js_url_es5" if es5 else "frontend_extra_module_url"
        hass.data.setdefault(key, set()).add(url)

    def remove_extra_js_url(hass: Any, url: str, es5: bool = False) -> None:  # type: ignore[misc]
        key = "frontend_extra_js_url_es5" if es5 else "frontend_extra_module_url"
        hass.data.setdefault(key, set()).discard(url)

    async_call_later = None  # type: ignore[assignment]
    SolarSkyDataUpdateCoordinator = None  # type: ignore[assignment,misc]
    async_register_http_views = None  # type: ignore[assignment]
    PLATFORMS = ["sensor"]
    HAS_HOMEASSISTANT = False

_LOGGER = logging.getLogger(__name__)


def _compute_bundle_digest(www_dir: Path, card_file: Path) -> str:
    """Compute an 8-char SHA-256 digest across all JS bundles in www/ for cache-busting."""
    try:
        hasher = hashlib.sha256()
        js_files = sorted(p for p in www_dir.glob("*.js") if p.is_file())
        if not js_files:
            hasher.update(card_file.read_bytes())
        else:
            for js_file in js_files:
                hasher.update(js_file.name.encode("utf-8"))
                hasher.update(js_file.read_bytes())
        return hasher.hexdigest()[:8]
    except OSError:
        return VERSION


def _register_extra_module_url_safely(hass: Any, base_url: str, versioned_url: str) -> None:
    """Register the card entry module in index.html (`extra_module_url`) for instant boot load."""
    try:
        manager = hass.data.get("frontend_extra_module_url")
        existing_urls = list(getattr(manager, "urls", manager) or ())
        for url in existing_urls:
            if isinstance(url, str) and url.partition("?")[0] == base_url and url != versioned_url:
                try:
                    remove_extra_js_url(hass, url)
                except Exception:  # noqa: BLE001
                    pass
        add_extra_js_url(hass, versioned_url)
    except KeyError:
        # `frontend` integration not initialized yet (e.g. headless test harness or safe mode)
        _LOGGER.debug("Skipping extra_module_url preload; frontend data key not initialized")


async def async_register_lovelace_card(hass: HomeAssistant) -> None:
    """Serve the bundled card JS and idempotently register it for both boot preload & Lovelace."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("card_registered"):
        return

    www_dir = Path(__file__).parent / "www"
    card_file = www_dir / CARD_FILENAME
    if not www_dir.is_dir() or not card_file.is_file():
        _LOGGER.warning("Bundled Lovelace card missing at %s; skipping frontend registration", card_file)
        return

    # Enable `cache_headers=True` so Home Assistant's CachingStaticResource serves
    # `Cache-Control: public, max-age=2678400` plus pre-compressed `.js.gz` sidecars;
    # `?v=<digest>` + content-hashed MapLibre chunk names guarantee instant invalidation on upgrade.
    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL_BASE, str(www_dir), True)]
        )
    except RuntimeError:
        _LOGGER.debug("Static path already registered: %s", STATIC_URL_BASE)

    digest = await hass.async_add_executor_job(_compute_bundle_digest, www_dir, card_file)
    base_url = f"{STATIC_URL_BASE}/{CARD_FILENAME}"
    versioned_url = f"{base_url}?v={digest}"

    # 1. Preload via `add_extra_js_url` so iOS WKWebView fetches the tiny card entry in index.html
    #    before WebSocket external_auth & Lovelace mount (eliminating the 2s timeout & panel race).
    _register_extra_module_url_safely(hass, base_url, versioned_url)

    # 2. Also sync into Lovelace storage resources so reconnects / HA restarts without a full HTML
    #    reload (`home-assistant/frontend#56060`) still load the exact same deduplicated module URL.
    lovelace = hass.data.get("lovelace")
    mode = getattr(lovelace, "mode", None) or (lovelace.get("mode") if isinstance(lovelace, dict) else None)
    resources = getattr(lovelace, "resources", None) or (
        lovelace.get("resources") if isinstance(lovelace, dict) else None
    )

    if mode == "storage" and resources is not None:

        async def _sync_storage_resource(_now: Any = None) -> None:
            if not getattr(resources, "loaded", True):
                if async_call_later is not None:
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
                # Remove any stale duplicate solar-sky-radar-card.js resource entries
                delete_fn = getattr(resources, "async_delete_item", None)
                if callable(delete_fn):
                    for duplicate in existing[1:]:
                        dup_id = duplicate.get("id")
                        if dup_id is not None:
                            await delete_fn(dup_id)
            else:
                await resources.async_create_item({"res_type": "module", "url": versioned_url})

        await _sync_storage_resource()

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
