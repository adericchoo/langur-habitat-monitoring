# Basemap protocol

Reference note for how satellite basemap imagery is produced, stored, and served
— and how that should scale from the current 2 years to the full ~25-year
time series. Written 2026-11-12. Status: **current state is dev-only; the
production protocol below is proposed, not yet implemented.**

## TL;DR

- Basemap tiles are **derived artifacts**: never in git, and for production
  never bundled inside the app (`web/public/`).
- Target production shape: **one PMTiles file per year on object storage + CDN**,
  listed in a **runtime manifest**, read directly by MapLibre.
- Adding a year should be: generate file → upload → append one manifest line.
  No app code change, no redeploy.

## Current state (dev)

- Format: XYZ **PNG pyramid, zoom 8–13**, built with `gdal2tiles` from the
  per-year Sentinel-2 / Landsat export (EPSG:3857, PNG alpha so outside-AOI is
  transparent).
- Location served in dev: `web/public/basemap/tiles/` (2025) and
  `web/public/basemap/tiles-2000/` (2000). Gitignored (`web/public/basemap/`),
  never committed.
- Size today: 2025 ≈ 49 MB / 510 tiles, 2000 ≈ 30 MB / 757 tiles (~79 MB total).
- Code: `web/src/components/MapStage.tsx` — `BASEMAP_TILES_BY_YEAR` hardcodes the
  two years, with `VITE_BASEMAP_TILES` / `VITE_BASEMAP_TILES_2000` env overrides
  for hosted paths. The display-year selector snaps to the nearest available
  basemap year.
- **Gotcha:** because the tiles are local-only, they do **not** travel with a git
  clone or repo migration. They must be copied or regenerated per machine. (This
  is why they went missing after the move to `langur-fresh`.)

## Why the current shape doesn't scale to 25 years

- Linear estimate: ~40 MB/year → **~1 GB for 25 years** at zoom 8–13 (fine).
- But adding zoom 14–16 multiplies tile count ~4× per level → **tens of GB and
  millions of tiny PNG files**. Loose XYZ pyramids are then slow to upload, slow
  to list, and awkward to cache/invalidate.
- Shipping tiles in `web/public/` couples them to the app deploy: every redeploy
  ships the whole set, and adding a year needs a code change + redeploy.

## Proposed production protocol

1. **Package each year as a single PMTiles file** (`basemap-<year>.pmtiles`)
   instead of a loose XYZ pyramid. MapLibre reads it from object storage via HTTP
   range requests — no tile server, no millions of files, one upload per year.
   (`gdal2tiles` XYZ can stay as an optional quick local-dev path.)
2. **Host on object storage + CDN** — S3 / Cloudflare R2 / GCS behind a CDN.
   R2 is attractive (no egress fees). App fetches `https://cdn/.../basemap-<year>.pmtiles`.
3. **Runtime manifest** replaces the hardcoded `BASEMAP_TILES_BY_YEAR` map. A
   small `manifest.json` lists available years + URLs (+ sensor), fetched at
   startup. The year selector and nearest-year snapping read from it:
   ```json
   { "years": [ { "year": 2001, "url": ".../basemap-2001.pmtiles", "sensor": "landsat7" } ] }
   ```
   Adding a year = upload file + append one line. No app change, no redeploy.
4. **Reproducible generation pipeline committed as code** (output stays
   gitignored): yearly export (COG) → reproject → tile → pack to PMTiles →
   upload + manifest update. The loop is what makes 25 years tractable.

## Open / owner decisions

- **Security — public vs gated hosting.** A publicly readable CDN folder of
  imagery cropped to langur habitat is itself a map of the AOI. If the AOI extent
  is sensitive, use signed URLs / token-gated CDN rather than a public bucket.
  **Owner: project + industry partner (discussion pending as of 2026-11-12).**
  See `SECURITY.md` for the location-data tiering this needs to fit.
- **Zoom range.** Stay at z8–13 (~1 GB total) or extend to z14–16 for
  street-level detail (tens of GB; strengthens the case for PMTiles). Decision
  drives storage cost and generation time.
- **Sensor consistency across the series.** Sentinel-2 only reaches ~2015; the
  pre-2015 years are Landsat 5/7/8 (30 m vs 10 m, different radiometry). A smooth
  time-slider needs color/radiometric normalization across sensors or years will
  visibly jump. *Team is already aware; noted here for completeness.* This is a
  generation-pipeline concern.

## Suggested implementation order (when we proceed)

1. **Manifest-driven loader** in `MapStage.tsx` — removes the hardcoded year map
   and the dev/prod `??` split. Self-contained and testable without hosting.
2. **Generation + upload pipeline script** with PMTiles packaging documented.
3. Wire prod env/manifest URL; keep the local `web/public/basemap/` copy for dev.
