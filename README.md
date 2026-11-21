# Solar Sky Radar for Home Assistant (HACS)

A Home Assistant **HACS Custom Integration + Bundled Lovelace MapLibreGL Card** (`custom:solar-sky-radar-card`) combining **high-resolution Satellite Visible True Colour imagery**, **Solar PV Cloud Classification**, **5-minute Rain Radar**, **animated dual-altitude Wind Streamlines**, **Lightning strikes**, and **Active Fire Hotspots** with a **preloaded 2-hour jogging playback slider**.

Built with **Melbourne & Australia as highest priority** (500 m Himawari-9 visible pan-sharpening, native Australian BOM 5-minute WMTS radar, BOM dark/light basemaps, and zero-key Geoscience Australia DEA bushfire hotspots) while automatically adapting **globally** across North/South America, Europe, Africa, the Middle East, and Asia-Pacific.

---

## Key Capabilities

### 1. Satellite Visible True Colour + Visual Cloud Overlay for Solar PV
Most Home Assistant radar cards only display precipitation echoes—leaving solar PV owners blind to non-precipitating cloud decks that slash inverter output by 60–85%. **Solar Sky Radar** processes 2 hours of 10-minute geostationary full-disk tiles server-side and exposes two selectable cloud modes:

- **Satellite Visible True Colour (`true_colour`)**: 1 km GeoColor true-colour RGB pan-sharpened with **500 m Band-03 red visible reflectance** during daylight so individual cumulus streets, sea-breeze convergence lines, and valley fog over Port Phillip Bay and Greater Melbourne stay crisp.
- **Clean Cloud Mask (`cloud_mask`)**: Feather-edged white/slate cloud deck overlay with stationary land-albedo floor subtraction (preventing bright inland Australian soils and salt lakes from false-triggering as cloud).
- **Solar PV Cloud Classification (`solar_cloud`)**: Combines daytime visible optical thickness, 5×5 spatial edge variance, and 10.4 µm IR cloud-top coldness to classify clouds by how they affect rooftop solar generation:
  - **Ice Cyan** — *Thin High Cirrus*: High cold ice crystal veil with low optical thickness (~65–85% diffuse/direct transmittance; smooth, predictable PV output).
  - **Amber Gold** — *Patchy Low/Mid Cumulus*: High spatial edge density causing rapid cloud-edge lensing and inverter ramping (intermittent solar).
  - **Violet-Magenta** — *Thick Storm / Frontal Deck*: Optically dense + cold convective/frontal cloud tops causing steep solar PV drops (<20% clear-sky output) — ideal trigger for pre-charging a home battery or pausing EV charging.

### 2. Upwind Solar Arrival Arcs & Home Assistant Sensors
Surface (`10 m`) anemometers rarely match the speed or direction of clouds at `1.5–3.0 km` altitude. The integration queries **850 hPa cloud-steering winds** alongside **10 m surface winds**, draws **15 / 30 / 60-minute upwind arrival arcs** into your home solar array on the map, and creates **6 native Home Assistant sensors** for dashboards and automations:

| Sensor Entity | Unit | Description |
| :--- | :---: | :--- |
| `sensor.<name>_solar_sky_regime` | enum | `clear_reliable`, `thin_high_cloud`, `partly_cloudy`, `patchy_unreliable`, `overcast_low`, `storm_approaching`, or `storm_overhead` (includes `forecast_60m` attribute) |
| `sensor.<name>_solar_reliability_score` | `%` | `0–100%` composite steadiness score for daytime solar PV generation |
| `sensor.<name>_estimated_solar_transmittance` | `%` | Estimated percentage of clear-sky irradiance reaching panels right now |
| `sensor.<name>_satellite_cloud_cover` | `%` | Satellite-measured cloud fraction within ~12 km of home |
| `sensor.<name>_cloud_patchiness_index` | index | `0–100` spatial cloud-edge variability (`low` / `moderate` / `high` ramping risk) |
| `sensor.<name>_approaching_cloud_eta` | `min` | Estimated minutes until an upwind thick cloud band arrives (`clearing_eta_min` in attributes) |

### 3. Multi-Hazard Weather Stack (Label-on-Top Vector Basemap)
Weather rasters are injected *below* MapLibre road, suburb label, and coastline boundary layers so place names remain sharp even under dense cloud and heavy rain echoes:

1. **Satellite True Colour** (`Himawari-9` `140.7°E`, `GOES-19` `-75.2°W`, `GOES-18` `-137.2°W`, `Meteosat-0°`, `Meteosat-9` `45.5°E` via CIRA SLIDER HTTPS + JMA Bosai fallback + optional BOM Anonymous FTP).
2. **Visual Cloud / Solar PV Classification** (`cloud_mask` or `solar_cloud`).
3. **Rain Radar** (**Australian BOM 5-minute Public WMTS** `atm_surf_air_precip_reflectivity_dbz` across Australia; **RainViewer Universal Blue** 10-minute global radar elsewhere).
4. **Animated Wind Streamlines** (60 fps Canvas particle trails toggleable between **`850 hPa` Cloud-Steering** and **`10 m` Surface** wind grids from Open-Meteo).
5. **NASA FIRMS + Australian DEA Active Fire Hotspots** (`VIIRS 375 m` & `MODIS 1 km` FRP-scaled thermal clusters via server-held NASA FIRMS `MAP_KEY`, plus zero-key **Geoscience Australia DEA Hotspots** including 10-minute `Himawari-9 AHI` bushfire detections across Australia).
6. **2-Hour Time-Synced Lightning Strikes** (ingests Home Assistant's native `blitzortung` integration `geo_location.*` entities and age-grades strikes from bright white `<10m` -> yellow `<30m` -> amber `<60m` -> red `<120m` in sync with the playback slider).

### 4. Zero-Flicker 2-Hour Jogging Slider
All 2 hours of WebP frames (`true_colour`, `cloud_mask` / `solar_cloud`, and `radar`) are preloaded into browser `Blob` URLs in reverse chronological order so dragging the jogging slider scrubs smoothly at 60 fps with:
- Play / Pause loop (dwells briefly on `Now` before looping `-2h -> Now`)
- Single-frame step buttons (`◀` / `▶`)
- Speed selector (`0.5×`, `1×`, `1.5×`, `2×`)
- Dual **Local Time + Relative Offset** readout (`10:40 (-15m)` / `Now`) and per-slot preload readiness ticks.

---

## Installation via HACS

1. Open **HACS** in Home Assistant.
2. Click the three-dot menu (`⋮`) in the top-right corner and choose **Custom repositories**.
3. Paste `https://github.com/lossanarch/solar-sky-radar` and select Category: **Integration**.
4. Click **Download** on **Solar Sky Radar**.
5. **Restart Home Assistant**.
6. Go to **Settings -> Devices & Services -> Add Integration** and search for **Solar Sky Radar**:
   - Latitude & Longitude prefill automatically from your Home Assistant Home Zone (e.g. Melbourne `-37.8136, 144.9631`).
   - Adjust **Regional Coverage Radius** (`1.5°–7.0°`, default `3.5°` ≈ 750 km box).
   - *(Optional)* Paste a free **NASA FIRMS `MAP_KEY`** (obtainable in 1 minute at <https://firms.modaps.eosdis.nasa.gov/api/map_key/>). Within Australia, **DEA Hotspots** works out-of-the-box even without a NASA FIRMS key.

> **Automatic Lovelace Card Registration:** When the integration loads, it automatically serves `/solar_sky_radar/www/solar-sky-radar-card.js` and registers it in Lovelace Storage resources with a content-hash `?v=<sha256>` cache-buster (with YAML-mode `add_extra_js_url` fallback). No manual resource copying is required.

---

## Adding the Lovelace Card

### Visual Card Picker (Recommended)
Edit any dashboard -> **Add Card** -> select **Solar Sky & Weather Radar** -> customize layers, cloud classification mode, wind altitude (`850 hPa` vs `10 m`), basemap theme, and opacity sliders live in the visual editor.

### YAML Configuration

```yaml
type: custom:solar-sky-radar-card
title: Melbourne Solar & Sky Radar
map_height: 500
zoom_level: 7.4
lock_map: true               # locks map to centre for mobile scrolling; tap lock/centre button to unlock
basemap_theme: auto          # auto | dark | light | bom_dark | bom_light
show_true_colour: true
true_colour_opacity: 1.0
show_cloud_overlay: false
cloud_mode: solar_cloud      # solar_cloud | cloud_mask
cloud_opacity: 0.58
show_radar: true
radar_opacity: 0.82
show_wind: true
wind_level: 850hPa           # 850hPa (cloud steering) | 10m (surface)
wind_opacity: 0.85
show_lightning: true
show_fires: true
show_solar_rings: true
show_solar_hud: true
show_legend: true
autoplay_mode: once          # off | once (plays 2h -> Live once when >=75% visible) | loop
playback_speed: 1
```

---

## Example Solar PV Battery Pre-Charge Automation

```yaml
automation:
  - alias: "Solar PV - Pre-hold Battery Before Approaching Heavy Cloud"
    trigger:
      - platform: numeric_state
        entity_id: sensor.solar_sky_radar_approaching_cloud_eta
        below: 25
    condition:
      - condition: sun
        after: sunrise
        before: sunset
    action:
      - service: notify.mobile_app
        data:
          title: "Heavy Cloud Approaching ({{ states('sensor.solar_sky_radar_approaching_cloud_eta') }} min)"
          message: "{{ state_attr('sensor.solar_sky_radar_solar_sky_regime', 'summary') }}"
```

---

## Local Development & Live Melbourne Preview Harness

You can develop and test the entire backend engine + bundled Lovelace card against live upstream satellite/radar/wind/fire feeds without a full Home Assistant instance:

```bash
# 1. Install frontend packages and build the bundled Lovelace card
npm install
npm run typecheck
npm run build:card

# 2. Set up Python virtualenv and run tests
python3 -m venv .venv
./.venv/bin/pip install -e . pytest pytest-asyncio
./.venv/bin/pytest -v
npm test

# 3. Launch the standalone live preview server (defaults to Melbourne on port 4791)
./.venv/bin/python dev/preview_server.py --host 127.0.0.1 --port 4791
```

Open `http://127.0.0.1:4791` to test `<solar-sky-radar-card>`, `<solar-sky-radar-card-editor>`, live HA sensor readouts, and instant region switching across **Melbourne, Sydney, Brisbane, Perth, Tokyo, London, and New York**.

---

## Cutting SemVer GitHub Releases (for HACS)

Use `./scripts/release.sh` (or `npm run release -- <bump>`) to bump the version across `manifest.json`, `const.py`, `package.json`, and `pyproject.toml`, rebuild the bundled Lovelace card, run Vitest + Pytest, tag `vX.Y.Z`, and publish a GitHub Release with an attached manual-install `.zip`:

```bash
# Preview what a release will do without touching files or git
npm run release -- patch --dry-run

# Cut a patch, minor, major, or explicit SemVer release via gh CLI
npm run release -- patch -y
npm run release -- minor -y --notes "Add new satellite layer"
npm run release -- 0.2.0 -y

# Or push the commit + annotated tag only and let GitHub Actions (.github/workflows/release.yml) publish the release
npm run release -- patch -y --tag-only
```
