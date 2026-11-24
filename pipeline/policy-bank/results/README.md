# Policy bank results

Committed snapshots of `policy-briefs.json` from runs on real data. The
working output in `../outputs/` stays gitignored; a file is copied here when
the team decides to keep a run.

| File | Run | Inputs | Code |
| --- | --- | --- | --- |
| `policy-briefs-2025.json` | 2017 → 2025 classification, build `build-20261123T125645Z` | 183 scored hotspots across 7 sites | case bank 0.5, policy config 0.4-provisional, commit `0ae6175` |

**Not yet reviewed by Save Vietnam's Wildlife.** Every option in the file
carries `reviewed_by_svw: false`. Treat it as screening output: each flagged
patch is a suspected land-cover change from satellite classification, and the
options are matched from the case bank by fixed rules.

**What it holds.** Site names, patch counts, areas, priority tiers, protection
status and hotspot ids, plus the matched policy options with their quoted
sources and the plain-English overview (under `overview`). It holds no
coordinates or geometry, in line with `SECURITY.md`; the hotspot ids only
resolve to locations through the scorer's outputs, which never enter git.

**Reading it.** The schema is described in `../README.md` (Run → Output).
`overview.sites.<site_id>` is the plain-English paragraph for each briefed
site, and `briefs[].groups[].options[].sources[]` carries each source's
`locator` and `quote`.

The dashboard's Policy step reads the compact version of the same run,
`web/src/results/policy-dashboard-2025.json`.

To regenerate, run the scorer and then the policy bank on the same build (see
`../README.md`); the same inputs give a byte-identical file.
