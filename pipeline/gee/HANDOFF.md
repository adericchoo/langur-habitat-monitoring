# GEE handoff — verified progress

Updated 2026-10-21 from the authorised Earth Engine project. This file is a
handoff summary, not a replacement for the live GEE scripts.

## Public-safe work completed

- `scripts/public/historical_timeseries_public_template.js` runs successfully.
- It requests annual screening summaries for 1985, 1990, 1995, 2000, 2005,
  2010, 2015, 2020 and 2025.
- It uses only public Landsat Collection 2 Level 2 data and a coarse placeholder
  rectangle; it does not contain private langur assets or locations.
- It produces annual NDVI, NDMI, MSAVI and BSI summaries and a CSV export task
  in `Earth Engine Exports`.
- The script includes a no-scene fallback so years without usable imagery do
  not fail with `Image.select` on an empty image.

## Verified private GEE results (not committed here)

- Official SVW current range: 1 feature.
- WOKAM inside official range: 1 feature.
- GLiM inside official range: 18 features.
- Protected areas: 7 features; private current langur areas: 7 features.
- 09C consensus screening (2000–2025): 941.78 ha moderate, 65.02 ha high,
  647.48 ha highest; 1,654.29 ha total possible-loss screening area.
- 10/10A Sentinel-2 baseline: 177 source scenes and 177 cloud-masked scenes.
- 11 AlphaEarth exploratory baseline: p25 similarity 0.5410, p75 0.8223.
- 12 private validation: high-similarity enrichment ratio 2.1735. This is an
  aggregate internal validation result, not a public habitat claim.
- 13 karst-likelihood V1: 64,593.83 ha moderate class; high/strong classes
  currently 0 ha. This is a geology/terrain screening map, not confirmed karst.

## Privacy boundary

The public repository must not contain private asset IDs, precise langur areas,
historical sightings, raw validation polygons, or sensitive exports. Keep the
full authorised scripts in the private GEE project/private repository. The
public historical template deliberately uses a coarse placeholder rectangle.

## Next GEE steps

1. Create a private historical time-series script by replacing the public
   placeholder with the authorised SVW current-range asset while preserving the
   1985–2025 years and no-scene fallback.
2. Run and privately export the historical summary CSV to `Earth Engine
   Exports`; record collection IDs, date windows, scale, CRS and run date.
3. Export the verified 09C consensus summary and 13 karst-likelihood summary
   privately.
4. Prepare spatially independent ground-truth polygons before training any
   segmentation classifier; report a confusion matrix and class-wise precision
   and recall.
5. Then build fragmentation/connectivity and risk metrics for the frontend data
   contract. Do not publish a classifier or risk layer until validation is
   documented.

## GitHub continuation

Current branch: `gee/D1-baseline-exports`. The public-safe commits are pushed
to the remote and should be reviewed before merging. Continue private work on a
private branch/repository; do not copy the full scripts into this public branch.
