# GEE scripts and privacy boundary

The live Earth Engine scripts are maintained in the authorised GEE project.
This public repository contains only safe templates and documentation until
the GitHub repository is private.

## Public-safe status

| Script/workflow | Public commit status | Reason |
| --- | --- | --- |
| 01–06 historical/provenance workflows | not copied yet | snapshots may contain project-specific geometry |
| 09A–09C historical change screening | not copied yet | current versions use project study-area context |
| 10/10A viewers | private-only | reference private layers and sightings |
| 11 AlphaEarth baseline | private-only | references private current-langur areas |
| 12 private validation | private-only | explicitly uses sensitive validation areas |
| 13 karst likelihood V1 | private-only until assets are templated | references project asset paths |

When the repository is private, the full authorised scripts can be added here
after review. Do not commit raw shapefiles, GeoTIFFs, precise coordinates, or
Earth Engine exports containing sensitive data.

## Local setup

Copy `asset_config.example.js` to a local, untracked file and replace the
placeholders with authorised asset IDs. Never commit that local file.
