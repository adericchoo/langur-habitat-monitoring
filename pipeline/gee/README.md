# Google Earth Engine pipeline

This directory documents the GEE-side processing for the habitat-monitoring
pipeline. The live scripts remain in the authorised Earth Engine project; do
not copy private assets or precise langur records into this public repository.

## Current baseline

- Sentinel-2 2025 cloud-masked composite and display-ready true-colour export
- NDVI, NDMI, MSAVI and BSI analysis layers
- Landsat 2000–2025 full-year and season-matched change screening
- GLiM/WOKAM geology-led karst-likelihood screening
- AlphaEarth exploratory similarity baseline

These are screening products. They are not confirmed habitat, karst, quarry,
or forest-loss labels.

## Required exports

Every release should provide non-sensitive GeoTIFF/CSV outputs with the
corresponding metadata in `data-contract/`:

- current satellite/index layers;
- historical change layer;
- classified habitat layer when reference labels are available;
- area and validation summary tables.

Use the Google Drive folder `Earth Engine Exports`. Keep private langur-area
and sighting layers in access-controlled Earth Engine assets and never export
them into this repository.

## Before adding a classifier

Prepare verified polygons for habitat classes and spatially independent
validation polygons. Quarry detection also requires verified quarry examples
and non-quarry lookalikes. Report a confusion matrix and class-wise precision
and recall; do not report training accuracy alone.

## Reproducibility checklist

- record the GEE script name/version and run date;
- record collection IDs, date windows, cloud masks, scale and projection;
- preserve class codes and palette meanings;
- include a limitations note with every output;
- review the result for sensitive coordinates before sharing.
