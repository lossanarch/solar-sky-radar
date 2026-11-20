"""Config flow and options flow for Solar Sky Radar."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

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
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    DEFAULT_RADIUS_DEG,
    DEFAULT_UPDATE_MINUTES,
    DOMAIN,
    NAME,
    PROVIDER_AUTO,
    RADAR_PROVIDER_BOM,
    RADAR_PROVIDER_RAINVIEWER,
    SAT_PROVIDER_GOES_EAST,
    SAT_PROVIDER_GOES_WEST,
    SAT_PROVIDER_HIMAWARI,
    SAT_PROVIDER_JMA,
    SAT_PROVIDER_METEOSAT_0,
    SAT_PROVIDER_METEOSAT_IODC,
)

SATELLITE_CHOICES = {
    PROVIDER_AUTO: "Auto (Best regional geostationary satellite)",
    SAT_PROVIDER_HIMAWARI: "Himawari-9 1km+500m (Melbourne / Australia / Asia-Pacific)",
    SAT_PROVIDER_GOES_EAST: "GOES-19 East 1km (Americas / Atlantic)",
    SAT_PROVIDER_GOES_WEST: "GOES-18 West 1km (Pacific / West Americas)",
    SAT_PROVIDER_METEOSAT_0: "Meteosat Prime 0E (Europe / Africa)",
    SAT_PROVIDER_METEOSAT_IODC: "Meteosat IODC 45.5E (Indian Ocean)",
    SAT_PROVIDER_JMA: "JMA Himawari Full Disk Tiles",
}

RADAR_CHOICES = {
    PROVIDER_AUTO: "Auto (BOM 5-min in Australia, RainViewer globally)",
    RADAR_PROVIDER_BOM: "Australian BOM WMTS (5-minute radar)",
    RADAR_PROVIDER_RAINVIEWER: "RainViewer Global Radar (10-minute radar)",
}


def _build_schema(defaults: dict[str, Any]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_LATITUDE, default=defaults[CONF_LATITUDE]): vol.All(
                vol.Coerce(float), vol.Range(min=-80.0, max=80.0)
            ),
            vol.Required(CONF_LONGITUDE, default=defaults[CONF_LONGITUDE]): vol.All(
                vol.Coerce(float), vol.Range(min=-180.0, max=180.0)
            ),
            vol.Required(CONF_RADIUS_DEG, default=defaults[CONF_RADIUS_DEG]): vol.All(
                vol.Coerce(float), vol.Range(min=1.2, max=8.0)
            ),
            vol.Required(CONF_SATELLITE_PROVIDER, default=defaults[CONF_SATELLITE_PROVIDER]): vol.In(
                SATELLITE_CHOICES
            ),
            vol.Required(CONF_RADAR_PROVIDER, default=defaults[CONF_RADAR_PROVIDER]): vol.In(
                RADAR_CHOICES
            ),
            vol.Optional(CONF_FIRMS_MAP_KEY, default=defaults.get(CONF_FIRMS_MAP_KEY, "")): str,
            vol.Required(CONF_ENABLE_DEA_HOTSPOTS, default=defaults[CONF_ENABLE_DEA_HOTSPOTS]): bool,
            vol.Required(CONF_ENABLE_BOM_FTP, default=defaults[CONF_ENABLE_BOM_FTP]): bool,
            vol.Required(CONF_UPDATE_MINUTES, default=defaults[CONF_UPDATE_MINUTES]): vol.All(
                vol.Coerce(int), vol.Range(min=2, max=30)
            ),
        }
    )


class SolarSkyRadarConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Solar Sky Radar."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        if user_input is not None:
            unique = f"{round(user_input[CONF_LATITUDE], 2)}_{round(user_input[CONF_LONGITUDE], 2)}"
            await self.async_set_unique_id(unique)
            self._abort_if_unique_id_configured()
            title = f"{NAME} ({user_input[CONF_LATITUDE]:.2f}, {user_input[CONF_LONGITUDE]:.2f})"
            return self.async_create_entry(title=title, data=user_input)

        ha_lat = getattr(self.hass.config, "latitude", None) or DEFAULT_LATITUDE
        ha_lon = getattr(self.hass.config, "longitude", None) or DEFAULT_LONGITUDE
        defaults = {
            CONF_LATITUDE: float(ha_lat),
            CONF_LONGITUDE: float(ha_lon),
            CONF_RADIUS_DEG: DEFAULT_RADIUS_DEG,
            CONF_SATELLITE_PROVIDER: PROVIDER_AUTO,
            CONF_RADAR_PROVIDER: PROVIDER_AUTO,
            CONF_FIRMS_MAP_KEY: "",
            CONF_ENABLE_DEA_HOTSPOTS: True,
            CONF_ENABLE_BOM_FTP: False,
            CONF_UPDATE_MINUTES: DEFAULT_UPDATE_MINUTES,
        }
        return self.async_show_form(step_id="user", data_schema=_build_schema(defaults))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        return SolarSkyRadarOptionsFlow(config_entry)


class SolarSkyRadarOptionsFlow(config_entries.OptionsFlow):
    """Allow updating location, radius, providers, and NASA FIRMS Map Key without reinstalling."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        merged = {
            CONF_LATITUDE: DEFAULT_LATITUDE,
            CONF_LONGITUDE: DEFAULT_LONGITUDE,
            CONF_RADIUS_DEG: DEFAULT_RADIUS_DEG,
            CONF_SATELLITE_PROVIDER: PROVIDER_AUTO,
            CONF_RADAR_PROVIDER: PROVIDER_AUTO,
            CONF_FIRMS_MAP_KEY: "",
            CONF_ENABLE_DEA_HOTSPOTS: True,
            CONF_ENABLE_BOM_FTP: False,
            CONF_UPDATE_MINUTES: DEFAULT_UPDATE_MINUTES,
            **self._entry.data,
            **self._entry.options,
        }
        return self.async_show_form(step_id="init", data_schema=_build_schema(merged))
