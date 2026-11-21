#!/usr/bin/env bash
# SemVer release script for Solar Sky Radar (Home Assistant / HACS + GitHub Releases)
#
# Usage:
#   ./scripts/release.sh <patch|minor|major|X.Y.Z> [--dry-run] [--yes] [--notes "..."] [--remote origin]
#   npm run release -- patch
#   npm run release -- 0.2.0 --notes "Add dual-inverter forecast sensor"

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

usage() {
  local current
  current="$(python3 -c 'import json; print(json.load(open("custom_components/solar_sky_radar/manifest.json"))["version"])')"
  cat <<EOF
Solar Sky Radar — SemVer GitHub Release Tool
Current version: v${current}

Usage:
  ./scripts/release.sh <patch|minor|major|X.Y.Z> [options]

Arguments:
  patch               Increment patch version (e.g. 0.1.3 -> 0.1.4)
  minor               Increment minor version (e.g. 0.1.3 -> 0.2.0)
  major               Increment major version (e.g. 0.1.3 -> 1.0.0)
  X.Y.Z / vX.Y.Z      Set an explicit SemVer version (supports optional -rc.1 pre-release)

Options:
  --dry-run           Compute version, validate, and show commands without modifying files or pushing
  -y, --yes           Skip interactive confirmation prompt
  --notes <text>      Custom release notes (otherwise uses GitHub auto-generated commit notes)
  --notes-file <path> Read release notes from a markdown file
  --prerelease        Mark the GitHub release as a pre-release (auto-enabled if version contains '-')
  --tag-only          Push commit and annotated vX.Y.Z tag only (let GitHub Actions publish the release)
  --remote <name>     Git remote to push to (auto-detects github.com remote or defaults to origin)
  --allow-dirty       Allow running with uncommitted changes (staged into release commit)
  -h, --help          Show this help message
EOF
}

BUMP_TARGET=""
DRY_RUN=0
ASSUME_YES=0
CUSTOM_NOTES=""
NOTES_FILE=""
PRERELEASE=0
TAG_ONLY=0
REMOTE_NAME=""
ALLOW_DIRTY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -y|--yes)
      ASSUME_YES=1
      shift
      ;;
    --notes)
      CUSTOM_NOTES="${2:?--notes requires a value}"
      shift 2
      ;;
    --notes-file)
      NOTES_FILE="${2:?--notes-file requires a path}"
      shift 2
      ;;
    --prerelease)
      PRERELEASE=1
      shift
      ;;
    --tag-only)
      TAG_ONLY=1
      shift
      ;;
    --remote)
      REMOTE_NAME="${2:?--remote requires a remote name}"
      shift 2
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      shift
      ;;
    -*)
      echo "Error: Unknown option '$1'" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -n "$BUMP_TARGET" ]]; then
        echo "Error: Unexpected positional argument '$1'" >&2
        usage >&2
        exit 1
      fi
      BUMP_TARGET="$1"
      shift
      ;;
  esac
done

if [[ -z "$BUMP_TARGET" ]]; then
  usage >&2
  exit 1
fi

CURRENT_VERSION="$(python3 -c 'import json; print(json.load(open("custom_components/solar_sky_radar/manifest.json"))["version"])')"

NEXT_VERSION="$(python3 - "$CURRENT_VERSION" "$BUMP_TARGET" <<'PY'
import re
import sys

cur = sys.argv[1].strip().lstrip("v")
target = sys.argv[2].strip()

semver_re = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$")
m_cur = semver_re.match(cur)
if not m_cur:
    sys.exit(f"Invalid current manifest version: {cur}")

major, minor, patch = int(m_cur.group(1)), int(m_cur.group(2)), int(m_cur.group(3))

if target == "patch":
    print(f"{major}.{minor}.{patch + 1}")
elif target == "minor":
    print(f"{major}.{minor + 1}.0")
elif target == "major":
    print(f"{major + 1}.0.0")
else:
    explicit = target.lstrip("v")
    if not semver_re.match(explicit):
        sys.exit(f"Invalid SemVer target '{target}'. Expected patch, minor, major, or X.Y.Z")
    print(explicit)
PY
)"

TAG="v${NEXT_VERSION}"
if [[ "$NEXT_VERSION" == *-* ]]; then
  PRERELEASE=1
fi

# Auto-detect GitHub remote if --remote was not specified
if [[ -z "$REMOTE_NAME" ]]; then
  if git remote get-url github >/dev/null 2>&1 && [[ "$(git remote get-url github)" == *"github.com"* ]]; then
    REMOTE_NAME="github"
  else
    REMOTE_NAME="origin"
  fi
fi

REMOTE_URL="$(git remote get-url "$REMOTE_NAME" 2>/dev/null || true)"
GH_REPO="$(python3 - "$REMOTE_URL" <<'PY'
import re
import sys

url = sys.argv[1].strip()
m = re.search(r"github\.com[:/]([^/]+/[^/.]+?)(?:\.git)?$", url)
print(m.group(1) if m else "")
PY
)"

echo "==> Preparing release ${TAG} (current: v${CURRENT_VERSION})"
echo "    Remote: ${REMOTE_NAME} (${GH_REPO:-$REMOTE_URL})"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Would update version to ${NEXT_VERSION} in:"
  echo "  - custom_components/solar_sky_radar/manifest.json"
  echo "  - custom_components/solar_sky_radar/const.py"
  echo "  - package.json"
  echo "  - pyproject.toml"
  echo "[dry-run] Would run: npm run typecheck && npm run build:card && npm test && pytest"
  echo "[dry-run] Would build HACS archive: dist/solar_sky_radar-${TAG}.zip"
  echo "[dry-run] Would commit, create annotated tag ${TAG}, push to ${REMOTE_NAME}, and run gh release create ${TAG}"
  exit 0
fi

# Pre-flight checks
if [[ "$ALLOW_DIRTY" -eq 0 ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: Working tree has uncommitted changes. Commit/stash them first or pass --allow-dirty." >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Error: Releases must be cut from 'main' (currently on '${BRANCH}')." >&2
  exit 1
fi

if [[ "$TAG_ONLY" -eq 0 ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "Error: GitHub CLI ('gh') is not installed. Install from https://cli.github.com/ or pass --tag-only." >&2
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo "Error: GitHub CLI ('gh') is not authenticated. Run 'gh auth login' or pass --tag-only." >&2
    exit 1
  fi
fi

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "Error: Local git tag '${TAG}' already exists." >&2
  exit 1
fi

if git ls-remote --exit-code --tags "$REMOTE_NAME" "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "Error: Remote tag '${TAG}' already exists on '${REMOTE_NAME}'." >&2
  exit 1
fi

if [[ "$ASSUME_YES" -eq 0 ]]; then
  read -r -p "Proceed with releasing ${TAG} to ${GH_REPO:-$REMOTE_NAME}? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# 1. Synchronize version across all manifest & package metadata files
python3 - "$NEXT_VERSION" <<'PY'
import json
from pathlib import Path
import re
import sys

ver = sys.argv[1]

# manifest.json
manifest_path = Path("custom_components/solar_sky_radar/manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["version"] = ver
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

# package.json
pkg_path = Path("package.json")
pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
pkg["version"] = ver
pkg_path.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")

# const.py
const_path = Path("custom_components/solar_sky_radar/const.py")
const_txt = const_path.read_text(encoding="utf-8")
const_txt, n1 = re.subn(r'^(VERSION(?:\s*:\s*Final)?\s*=\s*)"[^"]+"', rf'\1"{ver}"', const_txt, count=1, flags=re.M)
if n1 != 1:
    sys.exit("Failed to update VERSION in custom_components/solar_sky_radar/const.py")
const_path.write_text(const_txt, encoding="utf-8")

# pyproject.toml
pyproj_path = Path("pyproject.toml")
pyproj_txt = pyproj_path.read_text(encoding="utf-8")
pyproj_txt, n2 = re.subn(r'^(version\s*=\s*)"[^"]+"', rf'\1"{ver}"', pyproj_txt, count=1, flags=re.M)
if n2 != 1:
    sys.exit("Failed to update version in pyproject.toml")
pyproj_path.write_text(pyproj_txt, encoding="utf-8")
PY

# 2. Typecheck, build production Lovelace bundle, and run frontend + backend tests
echo "==> Building Lovelace card bundle and running test suites..."
npm run typecheck
npm run build:card
npm test

if [[ -x "./.venv/bin/pytest" ]]; then
  ./.venv/bin/pytest
elif command -v pytest >/dev/null 2>&1; then
  pytest
fi

# 3. Build clean release zip archive for manual installers (excludes __pycache__)
mkdir -p dist
ZIP_ASSET="dist/solar_sky_radar-${TAG}.zip"
rm -f "$ZIP_ASSET"
python3 - "$ZIP_ASSET" <<'PY'
from pathlib import Path
import sys
import zipfile

out_zip = Path(sys.argv[1])
src_dir = Path("custom_components/solar_sky_radar")
with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for p in sorted(src_dir.rglob("*")):
        if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc":
            zf.write(p, p.relative_to("custom_components"))
PY

# 4. Commit version bump (if changed), tag, push, and create GitHub Release
git add custom_components/solar_sky_radar/manifest.json \
        custom_components/solar_sky_radar/const.py \
        custom_components/solar_sky_radar/www/solar-sky-radar-card.js \
        package.json \
        pyproject.toml
if [[ "$ALLOW_DIRTY" -eq 1 ]]; then
  git add -A
fi

if ! git diff --cached --quiet; then
  git commit -m "chore(release): ${TAG}"
fi

git tag -a "$TAG" -m "Release ${TAG}"
echo "==> Pushing main and ${TAG} to ${REMOTE_NAME}..."
git push "$REMOTE_NAME" main
git push "$REMOTE_NAME" "$TAG"

if [[ "$TAG_ONLY" -eq 1 ]]; then
  echo "==> Pushed ${TAG} (--tag-only; GitHub Actions release workflow will publish the GitHub Release)."
  exit 0
fi

GH_ARGS=(
  "release" "create" "$TAG"
  "$ZIP_ASSET"
  "custom_components/solar_sky_radar/www/solar-sky-radar-card.js"
  "--title" "Solar Sky Radar ${TAG}"
)
if [[ -n "$GH_REPO" ]]; then
  GH_ARGS+=("--repo" "$GH_REPO")
fi
if [[ "$PRERELEASE" -eq 1 ]]; then
  GH_ARGS+=("--prerelease")
fi
if [[ -n "$NOTES_FILE" ]]; then
  GH_ARGS+=("--notes-file" "$NOTES_FILE")
elif [[ -n "$CUSTOM_NOTES" ]]; then
  GH_ARGS+=("--notes" "$CUSTOM_NOTES")
else
  GH_ARGS+=("--generate-notes")
fi

echo "==> Creating GitHub Release ${TAG}..."
gh "${GH_ARGS[@]}"
echo "==> Released ${TAG}!"
