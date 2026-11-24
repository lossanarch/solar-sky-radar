"""Tests for HACS metadata, manifest schema, and idempotent Lovelace resource registration."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from custom_components.solar_sky_radar import async_register_lovelace_card
from custom_components.solar_sky_radar.const import CARD_FILENAME, DOMAIN, STATIC_URL_BASE

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_hacs_and_manifest_metadata() -> None:
    hacs_path = REPO_ROOT / "hacs.json"
    manifest_path = REPO_ROOT / "custom_components" / "solar_sky_radar" / "manifest.json"
    strings_path = REPO_ROOT / "custom_components" / "solar_sky_radar" / "strings.json"
    en_path = REPO_ROOT / "custom_components" / "solar_sky_radar" / "translations" / "en.json"
    www_dir = REPO_ROOT / "custom_components" / "solar_sky_radar" / "www"
    card_bundle = www_dir / CARD_FILENAME
    card_bundle_gz = www_dir / f"{CARD_FILENAME}.gz"

    assert hacs_path.is_file()
    assert manifest_path.is_file()
    assert strings_path.is_file()
    assert en_path.is_file()
    assert card_bundle.is_file()
    assert card_bundle_gz.is_file()

    # Entry card module must remain lightweight (with MapLibre split into a lazy chunk)
    # so iOS WebKit parses and defines `<solar-sky-radar-card>` well before HA's 2s timeout.
    assert 20_000 < card_bundle.stat().st_size < 350_000
    assert card_bundle_gz.stat().st_size < 80_000
    card_src = card_bundle.read_text(encoding="utf-8")
    assert 'import("./solar-sky-radar-maplibre-' in card_src

    lazy_chunks = list(www_dir.glob("solar-sky-radar-maplibre-*.js"))
    assert len(lazy_chunks) == 1
    assert lazy_chunks[0].stat().st_size > 500_000
    assert Path(f"{lazy_chunks[0]}.gz").is_file()

    hacs = json.loads(hacs_path.read_text())
    assert hacs.get("content_in_root", False) is False
    assert hacs["render_readme"] is True

    manifest = json.loads(manifest_path.read_text())
    assert manifest["domain"] == DOMAIN
    assert manifest["config_flow"] is True
    assert "http" in manifest["dependencies"]
    assert "version" in manifest

    strings = json.loads(strings_path.read_text())
    en = json.loads(en_path.read_text())
    assert "config" in strings and "options" in strings
    assert strings["config"]["step"]["user"]["data"]["latitude"] == en["config"]["step"]["user"]["data"]["latitude"]


class _FakeResources:
    def __init__(self, initial: list[dict[str, Any]] | None = None) -> None:
        self.loaded = True
        self._items: list[dict[str, Any]] = list(initial or [])
        self._next_id = 100

    def async_items(self) -> list[dict[str, Any]]:
        return list(self._items)

    async def async_create_item(self, data: dict[str, Any]) -> dict[str, Any]:
        item = {"id": str(self._next_id), **data}
        self._next_id += 1
        self._items.append(item)
        return item

    async def async_update_item(self, item_id: str, data: dict[str, Any]) -> None:
        for item in self._items:
            if item["id"] == item_id:
                item.update(data)
                return

    async def async_delete_item(self, item_id: str) -> None:
        self._items = [item for item in self._items if item["id"] != item_id]


class _FakeHttp:
    def __init__(self) -> None:
        self.registered_paths: list[Any] = []

    async def async_register_static_paths(self, configs: list[Any]) -> None:
        self.registered_paths.extend(configs)


class _FakeHass:
    def __init__(self, lovelace_data: Any) -> None:
        self.data: dict[str, Any] = {"lovelace": lovelace_data}
        self.http = _FakeHttp()

    async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
        return func(*args)


@pytest.mark.asyncio
async def test_lovelace_storage_resource_registration_idempotent() -> None:
    resources = _FakeResources()
    hass = _FakeHass({"mode": "storage", "resources": resources})

    await async_register_lovelace_card(hass)  # type: ignore[arg-type]
    assert len(hass.http.registered_paths) == 1
    assert hass.http.registered_paths[0].cache_headers is True
    assert len(resources.async_items()) == 1
    first_url = resources.async_items()[0]["url"]
    assert first_url.startswith(f"{STATIC_URL_BASE}/{CARD_FILENAME}?v=")
    assert first_url in hass.data["frontend_extra_module_url"]

    # Calling a second time in the same HA runtime is a no-op
    await async_register_lovelace_card(hass)  # type: ignore[arg-type]
    assert len(resources.async_items()) == 1

    # Simulate stale ?v=oldhash + duplicate resource entries across HA restarts
    stale_resources = _FakeResources(
        [
            {"id": "existing-1", "res_type": "module", "url": f"{STATIC_URL_BASE}/{CARD_FILENAME}?v=00000000"},
            {"id": "duplicate-2", "res_type": "module", "url": f"{STATIC_URL_BASE}/{CARD_FILENAME}?v=11111111"},
        ]
    )
    hass2 = _FakeHass({"mode": "storage", "resources": stale_resources})
    hass2.data["frontend_extra_module_url"] = {f"{STATIC_URL_BASE}/{CARD_FILENAME}?v=00000000"}
    await async_register_lovelace_card(hass2)  # type: ignore[arg-type]
    assert len(stale_resources.async_items()) == 1
    assert stale_resources.async_items()[0]["url"] == first_url
    assert hass2.data["frontend_extra_module_url"] == {first_url}


@pytest.mark.asyncio
async def test_lovelace_yaml_mode_fallback() -> None:
    hass = _FakeHass({"mode": "yaml", "resources": None})
    await async_register_lovelace_card(hass)  # type: ignore[arg-type]
    assert hass.data[DOMAIN]["card_registered"] is True
    assert len(hass.data["frontend_extra_module_url"]) == 1


def test_semver_release_script_dry_run() -> None:
    import subprocess

    script = REPO_ROOT / "scripts" / "release.sh"
    assert script.is_file()

    manifest = json.loads(
        (REPO_ROOT / "custom_components" / "solar_sky_radar" / "manifest.json").read_text()
    )
    major, minor, patch = (int(x) for x in manifest["version"].split("."))

    res_patch = subprocess.run(
        ["bash", str(script), "patch", "--dry-run"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    assert f"v{major}.{minor}.{patch + 1}" in res_patch.stdout

    res_minor = subprocess.run(
        ["bash", str(script), "minor", "--dry-run"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    assert f"v{major}.{minor + 1}.0" in res_minor.stdout

    res_explicit = subprocess.run(
        ["bash", str(script), "1.2.3", "--dry-run"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    assert "v1.2.3" in res_explicit.stdout
