"""Home Assistant sensors exposing satellite solar sky regime, patchiness, and cloud ETA."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import (
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, NAME, VERSION
from .coordinator import SolarSkyDataUpdateCoordinator
from .solar_analysis import SolarCloudAnalysis


@dataclass(frozen=True, kw_only=True)
class SolarSkySensorDescription(SensorEntityDescription):
    """Describes a Solar Sky Radar sensor entity."""

    value_fn: Callable[[SolarCloudAnalysis], Any]
    attrs_fn: Callable[[SolarCloudAnalysis], dict[str, Any]] | None = None


SENSORS: tuple[SolarSkySensorDescription, ...] = (
    SolarSkySensorDescription(
        key="solar_sky_regime",
        name="Solar Sky Regime",
        icon="mdi:weather-partly-cloudy",
        value_fn=lambda a: a.regime,
        attrs_fn=lambda a: {
            "label": a.regime_label,
            "summary": a.summary,
            "reliability_score": a.solar_reliability_score,
            "cloud_wind_speed_kmh": round(a.cloud_wind_speed_kmh, 1),
            "cloud_wind_from_deg": round(a.cloud_wind_from_deg, 0),
            "forecast_60m": a.forecast_60m,
        },
    ),
    SolarSkySensorDescription(
        key="solar_reliability_score",
        name="Solar Reliability Score",
        icon="mdi:solar-power-variant",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda a: a.solar_reliability_score,
    ),
    SolarSkySensorDescription(
        key="estimated_solar_transmittance",
        name="Estimated Solar Transmittance",
        icon="mdi:white-balance-sunny",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda a: a.estimated_transmittance_pct,
    ),
    SolarSkySensorDescription(
        key="satellite_cloud_cover",
        name="Satellite Cloud Cover",
        icon="mdi:cloud-percent",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda a: round(a.local_cloud_cover_pct, 1),
    ),
    SolarSkySensorDescription(
        key="cloud_patchiness_index",
        name="Cloud Patchiness Index",
        icon="mdi:texture-box",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda a: round(a.patchiness_index, 1),
        attrs_fn=lambda a: {
            "ramping_risk": (
                "high" if a.patchiness_index >= 40 else "moderate" if a.patchiness_index >= 22 else "low"
            ),
        },
    ),
    SolarSkySensorDescription(
        key="approaching_cloud_eta",
        name="Approaching Heavy Cloud ETA",
        icon="mdi:weather-lightning-rainy",
        native_unit_of_measurement=UnitOfTime.MINUTES,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda a: a.approaching_cloud_eta_min,
        attrs_fn=lambda a: {
            "clearing_eta_min": a.clearing_eta_min,
            "upwind_bearing_deg": round(a.cloud_wind_from_deg, 0),
            "cloud_speed_kmh": round(a.cloud_wind_speed_kmh, 1),
        },
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Solar Sky Radar sensors for a config entry."""
    coord: SolarSkyDataUpdateCoordinator = hass.data[DOMAIN]["coordinators"][entry.entry_id]
    async_add_entities([SolarSkySensorEntity(coord, entry, desc) for desc in SENSORS])


class SolarSkySensorEntity(CoordinatorEntity[SolarSkyDataUpdateCoordinator], SensorEntity):
    """Sensor entity backed by SolarSkyDataUpdateCoordinator."""

    _attr_has_entity_name = True
    entity_description: SolarSkySensorDescription

    def __init__(
        self,
        coordinator: SolarSkyDataUpdateCoordinator,
        entry: ConfigEntry,
        description: SolarSkySensorDescription,
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title or NAME,
            manufacturer="Solar Sky Radar",
            model=coordinator.engine.satellite.spec.label,
            sw_version=VERSION,
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self) -> Any:
        return self.entity_description.value_fn(self.coordinator.engine.solar_analysis)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self.entity_description.attrs_fn is None:
            return None
        return self.entity_description.attrs_fn(self.coordinator.engine.solar_analysis)
