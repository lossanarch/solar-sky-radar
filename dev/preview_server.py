#!/usr/bin/env python3
"""Standalone Home Assistant Lovelace live preview harness for Solar Sky Radar.

Runs the real `RadarSkyEngine` (defaulting to Melbourne, Victoria: -37.8136, 144.9631)
against live upstream Himawari-9 / GOES / Meteosat, BOM 5-min WMTS / RainViewer,
Open-Meteo 10m + 850hPa wind, DEA Hotspots / NASA FIRMS, and Blitzortung feeds,
and serves `<solar-sky-radar-card>` + `<solar-sky-radar-card-editor>` on port 4791.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
from pathlib import Path
import sys
from typing import Any

from aiohttp import ClientSession, ClientTimeout, web

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from custom_components.solar_sky_radar.const import API_BASE, CARD_FILENAME, STATIC_URL_BASE
from custom_components.solar_sky_radar.engine import RadarSkyEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
_LOGGER = logging.getLogger("solar_sky_radar.preview")

LOCATION_PRESETS: dict[str, dict[str, Any]] = {
    "melbourne": {
        "name": "Melbourne, VIC",
        "latitude": -37.8136,
        "longitude": 144.9631,
        "radius_deg": 2.4,
        "time_zone": "Australia/Melbourne",
    },
    "sydney": {
        "name": "Sydney, NSW",
        "latitude": -33.8688,
        "longitude": 151.2093,
        "radius_deg": 2.4,
        "time_zone": "Australia/Sydney",
    },
    "brisbane": {
        "name": "Brisbane, QLD",
        "latitude": -27.4705,
        "longitude": 153.0260,
        "radius_deg": 2.4,
        "time_zone": "Australia/Brisbane",
    },
    "perth": {
        "name": "Perth, WA",
        "latitude": -31.9505,
        "longitude": 115.8605,
        "radius_deg": 2.4,
        "time_zone": "Australia/Perth",
    },
    "tokyo": {
        "name": "Tokyo, Japan",
        "latitude": 35.6762,
        "longitude": 139.6503,
        "radius_deg": 2.5,
        "time_zone": "Asia/Tokyo",
    },
    "london": {
        "name": "London, UK",
        "latitude": 51.5072,
        "longitude": -0.1276,
        "radius_deg": 2.5,
        "time_zone": "Europe/London",
    },
    "new_york": {
        "name": "New York, USA",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "radius_deg": 2.5,
        "time_zone": "America/New_York",
    },
}

PREVIEW_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Solar Sky Radar — Home Assistant Lovelace Preview</title>
  <style>
    :root {
      color-scheme: dark;
      --primary-background-color: #0b1120;
      --ha-card-background: #0f172a;
      --card-background-color: #0f172a;
      --secondary-background-color: #1e293b;
      --primary-text-color: #f1f5f9;
      --secondary-text-color: #94a3b8;
      --divider-color: rgba(148, 163, 184, 0.16);
      --primary-color: #38bdf8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
      background: radial-gradient(circle at 15% 0%, #13203b 0%, #090e1a 60%);
      color: var(--primary-text-color);
      min-height: 100vh;
    }
    header.topbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 20px;
      background: rgba(15, 23, 42, 0.86);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--divider-color);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-badge {
      background: linear-gradient(135deg, #f59e0b, #38bdf8);
      color: #090e1a;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.06em;
      padding: 4px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .brand h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 650;
    }
    .brand span.sub {
      color: var(--secondary-text-color);
      font-size: 12.5px;
    }
    .preset-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .preset-btn {
      appearance: none;
      background: rgba(30, 41, 59, 0.78);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 999px;
      padding: 5px 11px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.14s ease;
    }
    .preset-btn:hover {
      border-color: rgba(56, 189, 248, 0.5);
      color: #f8fafc;
    }
    .preset-btn.active {
      background: rgba(56, 189, 248, 0.2);
      border-color: rgba(56, 189, 248, 0.7);
      color: #7dd3fc;
    }
    .preset-btn:disabled {
      opacity: 0.5;
      cursor: wait;
    }
    main.workspace {
      max-width: 1520px;
      margin: 0 auto;
      padding: 18px 20px 32px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 370px;
      gap: 18px;
      align-items: start;
    }
    @media (max-width: 1080px) {
      main.workspace {
        grid-template-columns: 1fr;
      }
    }
    .side-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .panel {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid var(--divider-color);
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    }
    .panel h2 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .entity-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .entity-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      border-radius: 9px;
      background: rgba(30, 41, 59, 0.52);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }
    .entity-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .entity-name {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .entity-id {
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #64748b;
    }
    .entity-val {
      font-size: 14px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #38bdf8;
    }
    .source-list {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.55;
      margin: 0;
      padding-left: 16px;
    }
    .source-list strong {
      color: #e2e8f0;
    }
  </style>
  <script type="module" src="/solar_sky_radar/www/solar-sky-radar-card.js"></script>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="brand-badge">HACS Preview</span>
      <div>
        <h1>Solar Sky &amp; Weather Radar Card</h1>
        <span class="sub" id="active-region-label">Melbourne, VIC (-37.8136, 144.9631) • Live Upstream Feeds</span>
      </div>
    </div>
    <div class="preset-bar" id="preset-bar">
      <button class="preset-btn active" data-preset="melbourne">Melbourne</button>
      <button class="preset-btn" data-preset="sydney">Sydney</button>
      <button class="preset-btn" data-preset="brisbane">Brisbane</button>
      <button class="preset-btn" data-preset="perth">Perth</button>
      <button class="preset-btn" data-preset="tokyo">Tokyo</button>
      <button class="preset-btn" data-preset="london">London</button>
      <button class="preset-btn" data-preset="new_york">New York</button>
    </div>
  </header>

  <main class="workspace">
    <section id="card-mount">
      <solar-sky-radar-card id="radar-card"></solar-sky-radar-card>
    </section>

    <aside class="side-stack">
      <section class="panel">
        <h2>
          <span>HA Solar Sky Sensors</span>
          <span id="regime-pill" style="color:#f8fafc;font-size:11px;text-transform:none;">Loading…</span>
        </h2>
        <div class="entity-list" id="entity-list">
          <div class="entity-row">
            <div class="entity-meta">
              <span class="entity-name">Local Cloud Cover</span>
              <span class="entity-id">sensor.solar_sky_cloud_cover</span>
            </div>
            <span class="entity-val" id="val-cloud">—</span>
          </div>
          <div class="entity-row">
            <div class="entity-meta">
              <span class="entity-name">Cloud Patchiness Index</span>
              <span class="entity-id">sensor.solar_sky_patchiness_index</span>
            </div>
            <span class="entity-val" id="val-patch">—</span>
          </div>
          <div class="entity-row">
            <div class="entity-meta">
              <span class="entity-name">Est. Solar Transmittance</span>
              <span class="entity-id">sensor.solar_sky_solar_transmittance</span>
            </div>
            <span class="entity-val" id="val-trans">—</span>
          </div>
          <div class="entity-row">
            <div class="entity-meta">
              <span class="entity-name">Approaching Cloud ETA</span>
              <span class="entity-id">sensor.solar_sky_approaching_cloud_eta</span>
            </div>
            <span class="entity-val" id="val-cloud-eta">—</span>
          </div>
          <div class="entity-row">
            <div class="entity-meta">
              <span class="entity-name">Sky Clearing ETA</span>
              <span class="entity-id">sensor.solar_sky_clearing_eta</span>
            </div>
            <span class="entity-val" id="val-clear-eta">—</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>Lovelace Visual Card Editor</h2>
        <solar-sky-radar-card-editor id="card-editor"></solar-sky-radar-card-editor>
      </section>

      <section class="panel">
        <h2>Active Telemetry Stack</h2>
        <ul class="source-list" id="telemetry-summary">
          <li><strong>Satellite:</strong> Initializing geostationary 2h buffer…</li>
          <li><strong>Rain Radar:</strong> Initializing radar tiles…</li>
          <li><strong>Wind Lines:</strong> Open-Meteo 10m + 850hPa steering</li>
          <li><strong>Hotspots:</strong> DEA Hotspots (AU) + NASA FIRMS</li>
        </ul>
      </section>
    </aside>
  </main>

  <script type="module">
    const card = document.getElementById("radar-card");
    const editor = document.getElementById("card-editor");

    let currentConfig = {
      type: "custom:solar-sky-radar-card",
      title: "Melbourne Solar & Sky Radar",
      map_height: 540,
      zoom_level: 7.4,
      basemap_theme: "dark",
      show_true_colour: true,
      true_colour_opacity: 0.88,
      show_cloud_overlay: true,
      cloud_mode: "solar_cloud",
      cloud_opacity: 0.76,
      show_radar: true,
      radar_opacity: 0.82,
      show_wind: true,
      wind_level: "850hPa",
      show_lightning: true,
      show_fires: true,
      show_solar_rings: true,
      show_solar_hud: true,
      show_legend: true,
      autoplay: false,
      playback_speed: 1,
    };

    let hassState = {
      config: {
        latitude: -37.8136,
        longitude: 144.9631,
        location_name: "Melbourne, VIC",
        time_zone: "Australia/Melbourne",
      },
      states: {},
      fetchWithAuth: (path, init) => fetch(path, init),
    };

    await customElements.whenDefined("solar-sky-radar-card");
    card.setConfig(currentConfig);
    card.hass = hassState;
    editor.setConfig(currentConfig);
    editor.hass = hassState;

    editor.addEventListener("config-changed", (ev) => {
      currentConfig = { ...ev.detail.config };
      card.setConfig(currentConfig);
      editor.setConfig(currentConfig);
    });

    async function syncSensorPanel() {
      try {
        const res = await fetch("/api/solar_sky_radar/manifest");
        if (!res.ok) return;
        const m = await res.json();
        const s = m.solar || {};
        document.getElementById("regime-pill").textContent = s.regime_label || "Ready";
        document.getElementById("val-cloud").textContent =
          s.local_cloud_cover_pct != null ? `${s.local_cloud_cover_pct}%` : "—";
        document.getElementById("val-patch").textContent =
          s.patchiness_index != null ? `${s.patchiness_index} / 100` : "—";
        document.getElementById("val-trans").textContent =
          s.estimated_transmittance_pct != null ? `${s.estimated_transmittance_pct}%` : "—";
        document.getElementById("val-cloud-eta").textContent =
          s.approaching_cloud_eta_min != null ? `${s.approaching_cloud_eta_min} min` : "None <=75m";
        document.getElementById("val-clear-eta").textContent =
          s.clearing_eta_min != null ? `${s.clearing_eta_min} min` : "Clear / >75m";

        const sat = m.providers?.satellite;
        const rad = m.providers?.radar;
        document.getElementById("telemetry-summary").innerHTML = `
          <li><strong>Satellite:</strong> ${sat?.label || sat?.id} (${sat?.frame_count || 0} frames)</li>
          <li><strong>Rain Radar:</strong> ${rad?.label || rad?.id} (${rad?.frame_count || 0} frames)</li>
          <li><strong>850hPa Steering:</strong> ${s.cloud_wind_speed_kmh ?? 0} km/h @ ${s.cloud_wind_from_deg ?? 0}°</li>
          <li><strong>Timeline Slots:</strong> ${m.timeline?.length || 0} synchronized steps (2h)</li>
        `;
      } catch (err) {
        console.warn("Failed to sync sensor panel:", err);
      }
    }

    syncSensorPanel();
    setInterval(syncSensorPanel, 20000);

    document.getElementById("preset-bar").addEventListener("click", async (ev) => {
      const btn = ev.target.closest("button[data-preset]");
      if (!btn) return;
      const presetKey = btn.dataset.preset;
      const buttons = document.querySelectorAll(".preset-btn");
      buttons.forEach((b) => { b.disabled = true; });
      document.getElementById("active-region-label").textContent =
        `Switching to ${btn.textContent} & fetching 2-hour satellite/radar frames…`;

      try {
        const res = await fetch("/api/dev/preset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset: presetKey }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        buttons.forEach((b) => b.classList.toggle("active", b === btn));

        hassState = {
          ...hassState,
          config: {
            latitude: data.preset.latitude,
            longitude: data.preset.longitude,
            location_name: data.preset.name,
            time_zone: data.preset.time_zone,
          },
        };
        currentConfig = {
          ...currentConfig,
          title: `${data.preset.name.split(",")[0]} Solar & Sky Radar`,
          center_latitude: data.preset.latitude,
          center_longitude: data.preset.longitude,
        };
        card.hass = hassState;
        card.setConfig(currentConfig);
        editor.setConfig(currentConfig);
        await card.refreshAllData(true);
        await syncSensorPanel();

        document.getElementById("active-region-label").textContent =
          `${data.preset.name} (${data.preset.latitude.toFixed(4)}, ${data.preset.longitude.toFixed(4)}) • Live Upstream Feeds`;
      } catch (err) {
        console.error("Preset switch failed:", err);
      } finally {
        buttons.forEach((b) => { b.disabled = false; });
      }
    });
  </script>
</body>
</html>
"""


def create_app() -> web.Application:
    """Create the standalone aiohttp preview application."""
    app = web.Application()
    default_preset = LOCATION_PRESETS["melbourne"]
    engine = RadarSkyEngine(
        lat=default_preset["latitude"],
        lon=default_preset["longitude"],
        radius_deg=default_preset["radius_deg"],
        firms_map_key=os.environ.get("NASA_FIRMS_MAP_KEY", ""),
        enable_dea_hotspots=True,
        poll_public_lightning=True,
    )

    app["engine"] = engine
    app["initial_ready"] = asyncio.Event()

    async def _on_startup(application: web.Application) -> None:
        timeout = ClientTimeout(total=45, connect=10)
        session = ClientSession(timeout=timeout)
        application["session"] = session

        async def _refresh_loop() -> None:
            while True:
                try:
                    _LOGGER.info(
                        "Refreshing Solar Sky Radar feeds for (%.4f, %.4f)…",
                        engine.lat,
                        engine.lon,
                    )
                    await engine.async_refresh(session)
                    sat_n = len(engine.satellite.get_ordered_frames())
                    rad_n = len(engine.radar.get_ordered_frames())
                    fire_n = len(engine.firms.current_geojson.get("features", []))
                    _LOGGER.info(
                        "Refresh complete: %d satellite frames, %d radar frames, %d fire hotspots, regime='%s'",
                        sat_n,
                        rad_n,
                        fire_n,
                        engine.solar_analysis.regime_label,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    _LOGGER.exception("Unexpected error in background refresh loop")
                finally:
                    application["initial_ready"].set()
                await asyncio.sleep(300)

        application["refresh_task"] = asyncio.create_task(_refresh_loop())

    async def _on_cleanup(application: web.Application) -> None:
        task: asyncio.Task[Any] | None = application.get("refresh_task")
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        session: ClientSession | None = application.get("session")
        if session:
            await session.close()

    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)

    async def handle_index(_request: web.Request) -> web.Response:
        return web.Response(text=PREVIEW_HTML, content_type="text/html")

    async def handle_manifest(_request: web.Request) -> web.Response:
        if engine._last_refresh_epoch == 0:
            try:
                await asyncio.wait_for(app["initial_ready"].wait(), timeout=35.0)
            except TimeoutError:
                pass
        return web.json_response(engine.build_manifest(api_base=API_BASE))

    async def handle_frame(request: web.Request) -> web.Response:
        layer = request.match_info["layer"]
        key = request.match_info["key"]
        if layer not in ("true_colour", "cloud_mask", "solar_cloud", "radar"):
            raise web.HTTPBadRequest(text="Invalid layer")
        raw = engine.get_frame_bytes(layer, key)
        if raw is None:
            raise web.HTTPNotFound(text="Frame not found")
        return web.Response(
            body=raw,
            content_type="image/webp",
            headers={"Cache-Control": "public, max-age=1800"},
        )

    async def handle_wind(_request: web.Request) -> web.Response:
        snap = engine.wind.current_snapshot
        return web.json_response(snap.to_api_dict() if snap else {"levels": {}})

    async def handle_hazards(_request: web.Request) -> web.Response:
        return web.json_response(engine.get_hazards_payload())

    async def handle_preset(request: web.Request) -> web.Response:
        payload = await request.json()
        preset_key = str(payload.get("preset", "melbourne")).lower()
        preset = LOCATION_PRESETS.get(preset_key)
        if preset is None:
            raise web.HTTPBadRequest(text=f"Unknown preset: {preset_key}")

        engine.satellite._frames.clear()
        engine.satellite._land_rgb_floor = None
        engine.radar._frames.clear()
        engine.update_settings(
            lat=preset["latitude"],
            lon=preset["longitude"],
            radius_deg=preset["radius_deg"],
        )
        await engine.async_refresh(app["session"])
        return web.json_response(
            {
                "status": "ok",
                "preset_key": preset_key,
                "preset": preset,
                "manifest": engine.build_manifest(api_base=API_BASE),
            }
        )

    www_dir = REPO_ROOT / "custom_components" / "solar_sky_radar" / "www"

    async def handle_card_js(_request: web.Request) -> web.FileResponse:
        return web.FileResponse(
            www_dir / CARD_FILENAME,
            headers={"Cache-Control": "no-cache"},
        )

    app.router.add_get("/", handle_index)
    app.router.add_get(f"{API_BASE}/manifest", handle_manifest)
    app.router.add_get(f"{API_BASE}/frame/{{layer}}/{{key}}", handle_frame)
    app.router.add_get(f"{API_BASE}/wind", handle_wind)
    app.router.add_get(f"{API_BASE}/hazards", handle_hazards)
    app.router.add_post("/api/dev/preset", handle_preset)
    app.router.add_get(f"{STATIC_URL_BASE}/{CARD_FILENAME}", handle_card_js)
    app.router.add_get(f"/solar_sky_radar/{CARD_FILENAME}", handle_card_js)
    return app


def main() -> None:
    parser = argparse.ArgumentParser(description="Solar Sky Radar Live Preview Server")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "4791")))
    args = parser.parse_args()

    _LOGGER.info("Starting Solar Sky Radar preview server on http://%s:%d", args.host, args.port)
    web.run_app(create_app(), host=args.host, port=args.port, print=None)


if __name__ == "__main__":
    main()
