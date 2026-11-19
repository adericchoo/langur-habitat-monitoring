# pipeline

Google Earth Engine + Python metrics that compute habitat loss, fragmentation and risk layers from satellite data.

The GEE-side baseline and reproducibility guidance are documented in
[`pipeline/gee/README.md`](gee/README.md). The shared output naming and field
conventions are in [`data-contract/gee-output-spec.md`](../data-contract/gee-output-spec.md).

Private Earth Engine assets and precise langur or threat locations are not
stored in this repository.

## Steps after classification

| Step | Folder | What it does |
| --- | --- | --- |
| Habitat-loss metrics | [`metrics/`](metrics/README.md) | summary metrics for the Habitat loss step |
| Priority scoring | `priority-scoring/` | ranks change hotspots on threat, value, exposure and governance |
| Policy bank | [`policy-bank/`](policy-bank/README.md) | lists sourced policy options for the highest-priority hotspots |
