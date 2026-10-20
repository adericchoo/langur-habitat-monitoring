# Langur Habitat Monitor — project guide

This guide is written for someone joining the project with no previous
context. The project monitors habitat conditions for Delacour's langur in
northern Vietnam and turns satellite observations into maps, metrics and
eventually decision-support reports.

## What the project does

The intended user journey is:

**Explore the map → inspect habitat loss → inspect fragmentation → review risk →
match policy evidence → generate a report.**

The project has two connected parts:

1. **Pipeline** — Google Earth Engine (GEE) prepares satellite composites,
   indices, historical-change screening and validation summaries.
2. **Web application** — the React/Vite/MapLibre frontend will display approved
   pipeline outputs and provide the map, metric and report workflow.

The frontend must consume documented, non-sensitive outputs. It must not access
raw sightings or private Earth Engine assets.

## Repository map

| Path | Purpose |
| --- | --- |
| `pipeline/gee/` | GEE processing notes, script boundary and handoff |
| `pipeline/gee/scripts/public/` | Public-safe examples using public data only |
| `pipeline/gee/scripts/asset_config.example.js` | Placeholder configuration for authorised local work |
| `data-contract/` | Field names and output conventions shared with the frontend |
| `web/` | React/Vite/MapLibre application |
| `docs/` | Project explanations and contributor handoffs |
| `SECURITY.md` | Mandatory sensitive-data rules |

## Branches

- `main` is the stable public-safe branch. It should contain reviewed
  documentation, templates and sanitised outputs only.
- `gee/private-historical-timeseries` is the active branch for preparing the
  next GEE workflow. The repository is currently public, so this branch is
  **not confidential**. Do not place private scripts, asset IDs, sightings or
  precise locations there.

For full production scripts, use an access-controlled private repository or
the authorised GEE project. A Git branch does not provide privacy inside a
public repository.

## Current verified progress

- Sentinel-2 baseline and index layers have been inspected.
- 2000–2025 Landsat full-year and season-matched loss screening is working.
- An official SVW range version of the 09C consensus screening is working.
- GLiM/WOKAM karst-evidence and terrain screening are working.
- AlphaEarth similarity and aggregate private validation have been run
  internally.
- The public historical template runs for 1985–2025 with a coarse placeholder
  area and no-scene fallback.
- A classifier, fragmentation/connectivity metrics, risk scoring and frontend
  integration still require implementation and validation.

See [`pipeline/gee/HANDOFF.md`](../pipeline/gee/HANDOFF.md) for the verified
GEE numbers and the next GEE-specific tasks.

## How to continue safely

1. Read `SECURITY.md`, this guide and `pipeline/gee/HANDOFF.md`.
2. Confirm which branch you are using with `git status --short --branch`.
3. Keep public work on `main` or a short-lived public-safe feature branch.
4. Keep private GEE work in authorised storage/private infrastructure.
5. Record the script name, date, collections, date windows, scale, projection,
   thresholds and limitations for every output.
6. Ask for review before merging.

## Interpretation rules

All current maps are screening products. A colour class or similarity score is
not proof of habitat, karst, quarry activity or forest loss. Validation with
SVW and independent reference data is required before high-confidence claims.
Historical values are comparable summaries only when the collection, masking,
season and method are documented consistently.

## Local commands

```bash
git switch main
git pull --ff-only origin main

# Frontend (when dependencies are available)
cd web
npm install
npm run dev
```

GEE scripts are run in the Google Earth Engine Code Editor, not with the local
Node commands. Exports should use the Google Drive folder `Earth Engine
Exports` and should be checked for sensitive content before sharing.
