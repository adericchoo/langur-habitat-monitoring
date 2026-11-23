#!/usr/bin/env python3
"""
07_build_hotspots.py — step 4a of the SVW habitat-monitoring pipeline.

Collates classifier outputs + the AIFG context layers into
hotspots-scoring-input.csv, the exact table score_priority.py reads.
All indicator columns are RAW PHYSICAL UNITS — normalisation lives in
priority_config.yaml / score_priority.py (step 4b).

CURRENT MODE: two-date change (classification_2017 -> classification_2025).
Consequences, stated honestly in the output:
  * t_first_year = 2017 for every patch (the change happened somewhere in
    2017-2025; the interval start is the only defensible value). Recency is
    therefore uninformative until yearly classifications exist.
  * t_rate_ha_yr = patch area / 8 (mean annual rate over the interval).
  * t_accel, t_persist_years: empty, t_accel_source=dropped_insufficient_history.
  * s_*, c_*, v_canopy_frac, e_connect_critical, g_unlicensed, g_access_km:
    empty — no epoch archive, probability raster, canopy clusters, or
    concession/ranger layers yet. The scorer renormalises over what exists.

Class encoding (verified empirically 23 Nov 2026 — langur records on class 2,
quarry belt on Kim Bang east flank class 1, ridge-top bare rock class 3,
lowland agricultural matrix class 4):
    1 = quarry   2 = karst forest   3 = bare rock   4 = other

Usage (paths point at your local "SVW data" + "DL records" folders — neither
raster nor shapefile data lives in this repository):
    python build_hotspots.py \
        --class-early "<SVW data>/classifications/classification_2017.tif" --year-early 2017 \
        --class-late  "<SVW data>/classifications/classification_2025.tif" --year-late  2025 \
        --pack "<path to>/DL records" \
        --out  outputs/hotspots-scoring-input.csv
Then:  python score_priority.py outputs/hotspots-scoring-input.csv outputs/priority-areas.csv
"""

import argparse
import hashlib
import warnings
from datetime import datetime, timezone
from pathlib import Path

warnings.filterwarnings("ignore")

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
import rasterio.transform as rt
from rasterio import features as rfeat
from shapely.geometry import shape, box

# ---------------------------------------------------------------- config ---
METRIC_CRS = "EPSG:32648"   # rasters are already in this; shapefiles are 4326
MMU_HA = 0.5
ADJ_BUFFER_M = 250          # e_adjacent_ha: forest within this of the patch
EDGE_BUFFER_M = 100         # e_edge_frac: site perimeter within this of patch
PA_BUFFER_M = 1000          # g_protected "buffer" zone
SITE_SCOPE_M = 1000         # patches within this of a DL area stay in scope

CLASS_QUARRY, CLASS_FOREST, CLASS_BARE, CLASS_OTHER = 1, 2, 3, 4
CHANGE_CLASSES = {
    (CLASS_FOREST, CLASS_QUARRY): "forest_to_quarry",
    (CLASS_BARE, CLASS_QUARRY): "bare_rock_extraction",
}

# Record reliability (framework §5; config treats it as record_reliability).
RECORD_WEIGHTS = {"drone": 1.0, "transect": 1.0, "observation": 0.9,
                  "sighting": 0.9, "listening": 0.6, "acoustic": 0.6,
                  "interview": 0.3, "report": 0.3}
DEFAULT_RECORD_WEIGHT = 0.9
UNCERTAIN_LOCATION_WEIGHT = 0.2
DRONE_LAYERS = {"2023 TMWC", "2024 TMWC _Yen Mo"}
UNCERTAIN_MARKERS = ("erroneous", "unknown distance", "uncertain")

# Site slugs matching the scorer's examples; keys match 'Name' in
# Current DL areas.shp (note the shapefile's own spellings).
SITE_SLUGS = {
    "Pu Luong Kast": "pu-luong-karst",
    "Cuc Phuong": "cuc-phuong",
    "Hoa Lu/ Trang An": "hoa-lu-trang-an",
    "Tam Diep Forest_NB": "tam-diep-forest-nb",
    "6. Huong Son_Lac Thuy": "huong-son-lac-thuy",
    "Kim Bang": "kim-bang",
    "Van Long NR-Dong Tam": "van-long-dong-tam",
}

# v_irrepl per site (framework §5 — SVW to overwrite after elicitation).
V_IRREPL = {"kim-bang": 1.0, "tam-diep-forest-nb": 0.9,
            "huong-son-lac-thuy": 0.9, "van-long-dong-tam": 0.7,
            "pu-luong-karst": 0.6, "cuc-phuong": 0.4, "hoa-lu-trang-an": 0.4}

NON_RECORD_LAYERS = {"Current DL areas", "Protected areas in historical range",
                     "Provincial boundary", "Species current range(Nadler2020)",
                     "Species historical range (Dao, 1970)"}

COLUMNS = ["hotspot_id", "site_id", "run_year", "change_class",
           "t_first_year", "t_area_ha", "t_rate_ha_yr", "t_accel",
           "t_accel_source", "t_persist_years", "s_intervals_with_loss",
           "s_longrun_rate_ha_yr", "s_trend", "v_remaining_ha",
           "v_canopy_frac", "v_langur_dist_m", "v_record_year",
           "v_site_last_record_year", "v_occupancy", "v_irrepl",
           "e_adjacent_ha", "e_edge_frac", "e_connect_critical",
           "g_protected", "g_designation", "g_iucn_cat", "g_pa_predates",
           "g_unlicensed", "g_access_km", "c_prob", "c_mixed", "c_views",
           "c_novelty", "c_corrob", "record_reliability", "truncated",
           "incomplete_fields", "years_of_history", "composite_recipe",
           "build_run_id", "source_config_hash",
           # extra provenance, ignored by the scorer but kept for the audit
           "centroid_lon", "centroid_lat", "geometry_wkt"]

EMPTY_NOW = ["t_accel", "t_persist_years", "s_intervals_with_loss",
             "s_longrun_rate_ha_yr", "s_trend", "v_canopy_frac",
             "e_connect_critical", "g_unlicensed", "g_access_km",
             "c_prob", "c_mixed", "c_views", "c_novelty", "c_corrob"]


def designation_key(desig_eng, iucn_cat):
    """Map WDPA DESIG_ENG onto the config's g_designation ordinal keys."""
    d = str(desig_eng or "")
    if "World Heritage" in d:
        return "World Heritage Site"
    if "National Park" in d:
        return "National Park"
    if "Nature Reserve" in d or "Species" in d or "Habitat" in d:
        return "Nature Reserve"
    if str(iucn_cat) == "V" or "Cultural" in d or "Landscape" in d \
            or "Scenic" in d or "Historical" in d:
        return "Cultural/Historical Landscape"
    return "Nature Reserve" if d else "none"


def infer_weight(layer, row):
    if layer in DRONE_LAYERS:
        return 1.0
    for field in ("Name", "Note", "Notes"):
        if any(m in str(row.get(field, "") or "").lower()
               for m in UNCERTAIN_MARKERS):
            return UNCERTAIN_LOCATION_WEIGHT
    rec = str(row.get("Record", "") or "").strip().lower()
    for key, w in RECORD_WEIGHTS.items():
        if key in rec:
            return w
    return DEFAULT_RECORD_WEIGHT


def harmonise_records(pack_dir):
    frames = []
    for shp in sorted(pack_dir.glob("*.shp")):
        if shp.stem in NON_RECORD_LAYERS:
            continue
        g = gpd.read_file(shp)
        g = g[g.geometry.notna()].copy()
        year = pd.to_numeric(
            g["Year"] if "Year" in g.columns
            else pd.Series(np.nan, index=g.index), errors="coerce")
        tok = shp.stem.split()[0]
        g["year"] = year.fillna(int(tok) if tok.isdigit() else np.nan)
        g["weight"] = [infer_weight(shp.stem, r) for _, r in g.iterrows()]
        frames.append(g[["year", "weight", "geometry"]])
    out = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True),
                           crs=frames[0].crs)
    print(f"  {len(out)} records from {len(frames)} layers")
    return out


def main(args):
    pack = Path(args.pack)
    y0, y1 = args.year_early, args.year_late
    span = y1 - y0

    print("[1/5] context layers")
    records = harmonise_records(pack).to_crs(METRIC_CRS)
    sites = gpd.read_file(pack / "Current DL areas.shp").to_crs(METRIC_CRS)
    sites["slug"] = sites["Name"].map(SITE_SLUGS)
    pas = gpd.read_file(
        pack / "Protected areas in historical range.shp").to_crs(METRIC_CRS)

    print("[2/5] change detection")
    with rasterio.open(args.class_early) as e, \
         rasterio.open(args.class_late) as l:
        assert e.transform == l.transform and e.shape == l.shape, \
            "rasters not on the same grid"
        a, b = e.read(1), l.read(1)
        transform, crs, rshape = e.transform, e.crs, e.shape
        pix_ha = abs(e.res[0] * e.res[1]) / 10_000
        raster_bbox = box(*e.bounds)
    forest_late = b == CLASS_FOREST

    print("[3/5] vectorising patches")
    pieces = []
    for (c_from, c_to), label in CHANGE_CLASSES.items():
        mask = (a == c_from) & (b == c_to)
        geoms = [shape(g) for g, v in
                 rfeat.shapes(mask.astype(np.uint8), mask=mask,
                              transform=transform, connectivity=8) if v == 1]
        gg = gpd.GeoDataFrame({"change_class": [label] * len(geoms)},
                              geometry=geoms, crs=crs)
        pieces.append(gg)
        print(f"  {label}: {len(gg)} raw polygons")
    patches = gpd.GeoDataFrame(pd.concat(pieces, ignore_index=True), crs=crs)
    patches = patches.to_crs(METRIC_CRS)
    patches["t_area_ha"] = patches.area / 10_000
    patches = patches[patches["t_area_ha"] >= MMU_HA].reset_index(drop=True)
    print(f"  {len(patches)} patches >= {MMU_HA} ha "
          f"({patches['t_area_ha'].sum():.0f} ha total)")

    # scope: patches intersecting a DL area, or within SITE_SCOPE_M of one —
    # the quarry faces advancing on a site from outside are the threat the
    # framework exists to rank, so boundary-hugging patches stay in scope.
    j = gpd.sjoin_nearest(patches, sites[["slug", "geometry"]], how="left",
                          distance_col="site_dist_m")
    j = j[~j.index.duplicated(keep="first")]
    patches["site_id"] = j["slug"].values
    patches["site_dist_m"] = j["site_dist_m"].values
    keep = patches["site_dist_m"] <= SITE_SCOPE_M
    print(f"  {int(keep.sum())} within {SITE_SCOPE_M} m of the 7 DL areas "
          f"(of which {int((patches['site_dist_m'] == 0).sum())} touch one; "
          f"{int((~keep).sum())} beyond scope, dropped)")
    patches = patches[keep].reset_index(drop=True)

    print("[4/5] context joins")
    # v_remaining_ha per site
    sites_src = sites.to_crs(crs)
    site_rast = rfeat.rasterize(
        ((g, i + 1) for i, g in enumerate(sites_src.geometry)),
        out_shape=rshape, transform=transform, fill=0, dtype="int32")
    v_rem = {s: float((forest_late & (site_rast == i + 1)).sum() * pix_ha)
             for i, s in enumerate(sites["slug"])}
    patches["v_remaining_ha"] = patches["site_id"].map(v_rem)

    # v_langur_dist_m + nearest record's year/weight
    near = gpd.sjoin_nearest(patches, records, how="left",
                             distance_col="v_langur_dist_m")
    near = near[~near.index.duplicated(keep="first")]
    patches["v_langur_dist_m"] = near["v_langur_dist_m"].round(0)
    patches["v_record_year"] = near["year"].astype("Int64")
    patches["record_reliability"] = near["weight"]

    # per-site evidence
    rec_in = gpd.sjoin(records, sites[["slug", "geometry"]], how="inner",
                       predicate="within")
    last = rec_in.groupby("slug")["year"].max().to_dict()
    post15 = rec_in[rec_in["year"] >= 2015].groupby("slug").size().to_dict()
    patches["v_site_last_record_year"] = (
        patches["site_id"].map(last).astype(int))
    patches["v_occupancy"] = patches["site_id"].map(
        lambda s: "confirmed" if post15.get(s, 0) > 0
        else "historical_unsurveyed")
    patches["v_irrepl"] = patches["site_id"].map(V_IRREPL)

    # e_adjacent_ha — windowed count of 2025 forest within 250 m
    e_adj = []
    inv = ~transform  # world -> pixel
    for geom in patches.geometry:
        buf = gpd.GeoSeries([geom.buffer(ADJ_BUFFER_M)],
                            crs=METRIC_CRS).to_crs(crs).iloc[0]
        minx, miny, maxx, maxy = buf.bounds
        c0, r0 = inv * (minx, maxy)
        c1, r1 = inv * (maxx, miny)
        r0, r1 = max(int(r0), 0), min(int(r1) + 1, rshape[0])
        c0, c1 = max(int(c0), 0), min(int(c1) + 1, rshape[1])
        win_tr = rt.Affine(transform.a, transform.b,
                           transform.c + c0 * transform.a,
                           transform.d, transform.e,
                           transform.f + r0 * transform.e)
        gsrc = gpd.GeoSeries([geom], crs=METRIC_CRS).to_crs(crs).iloc[0]
        ring = rfeat.rasterize([(buf, 1)], out_shape=(r1 - r0, c1 - c0),
                               transform=win_tr, fill=0, dtype="uint8")
        core = rfeat.rasterize([(gsrc, 1)], out_shape=(r1 - r0, c1 - c0),
                               transform=win_tr, fill=0, dtype="uint8")
        e_adj.append(float((forest_late[r0:r1, c0:c1] & (ring == 1)
                            & (core == 0)).sum() * pix_ha))
    patches["e_adjacent_ha"] = np.round(e_adj, 2)

    # e_edge_frac — share of the parent site's perimeter within 100 m
    site_geom = dict(zip(sites["slug"], sites.geometry))
    patches["e_edge_frac"] = [
        round(site_geom[s].boundary.intersection(
            g.buffer(EDGE_BUFFER_M)).length / site_geom[s].boundary.length, 4)
        for s, g in zip(patches["site_id"], patches.geometry)]

    # governance
    in_pa = gpd.sjoin(patches, pas[["NAME", "DESIG_ENG", "IUCN_CAT",
                                    "STATUS_YR", "geometry"]],
                      how="left", predicate="intersects")
    in_pa = in_pa[~in_pa.index.duplicated(keep="first")]
    npa = gpd.sjoin_nearest(patches, pas[["geometry"]], how="left",
                            distance_col="pa_dist_m")
    npa = npa[~npa.index.duplicated(keep="first")]
    inside = in_pa["NAME"].notna().values
    patches["g_protected"] = np.where(
        inside, "inside",
        np.where(npa["pa_dist_m"].values <= PA_BUFFER_M, "buffer", "outside"))
    patches["g_designation"] = [
        designation_key(d, c) if ok else "none"
        for ok, d, c in zip(inside, in_pa["DESIG_ENG"], in_pa["IUCN_CAT"])]
    # Only vocabulary priority_config.yaml knows: II, V, Not Reported, none.
    # Anything else WDPA reports (IV, Ia, "Not Applicable"...) maps to
    # "Not Reported" so the governance read never collapses on vocab alone.
    patches["g_iucn_cat"] = [
        (str(c).strip() if str(c).strip() in ("II", "V") else "Not Reported")
        if ok else "none"
        for ok, c in zip(inside, in_pa["IUCN_CAT"])]
    patches["g_pa_predates"] = [
        ("TRUE" if pd.notna(y) and 0 < float(y) <= y1 else "FALSE")
        if ok else "" for ok, y in zip(inside, in_pa["STATUS_YR"])]

    # truncated: patch touches the raster edge
    edge = gpd.GeoSeries([raster_bbox.boundary],
                         crs=crs).to_crs(METRIC_CRS).iloc[0]
    patches["truncated"] = [
        "TRUE" if g.intersects(edge.buffer(30)) else "FALSE"
        for g in patches.geometry]

    print("[5/5] assembling CSV")
    wgs = patches.to_crs("EPSG:4326")
    df = pd.DataFrame(index=patches.index)
    order = patches.sort_values("t_area_ha", ascending=False).index
    rank = {ix: i + 1 for i, ix in enumerate(order)}
    df["hotspot_id"] = [f"HS-{y1}-{rank[ix]:03d}" for ix in patches.index]
    df["site_id"] = patches["site_id"]
    df["run_year"] = y1
    df["change_class"] = patches["change_class"]
    df["t_first_year"] = y0   # interval start — see module docstring
    df["t_area_ha"] = patches["t_area_ha"].round(2)
    df["t_rate_ha_yr"] = (patches["t_area_ha"] / span).round(3)
    df["t_accel"] = ""
    df["t_accel_source"] = "dropped_insufficient_history"
    for c in ["v_remaining_ha", "v_langur_dist_m", "v_record_year",
              "v_site_last_record_year", "v_occupancy", "v_irrepl",
              "e_adjacent_ha", "e_edge_frac", "g_protected",
              "g_designation", "g_iucn_cat", "g_pa_predates",
              "record_reliability", "truncated"]:
        df[c] = patches[c].values
    df["v_remaining_ha"] = df["v_remaining_ha"].round(0)
    for c in EMPTY_NOW:
        df[c] = ""
    df["incomplete_fields"] = ";".join(sorted(
        EMPTY_NOW + ["t_recency_interval_start_only"]))
    df["years_of_history"] = 2
    df["composite_recipe"] = f"two_date_{y0}_{y1}"
    df["build_run_id"] = datetime.now(timezone.utc).strftime(
        "build-%Y%m%dT%H%M%SZ")
    h = hashlib.sha256()
    for p in (args.class_early, args.class_late):
        h.update(Path(p).read_bytes())
    df["source_config_hash"] = "sha256:" + h.hexdigest()[:8]
    df["centroid_lon"] = wgs.geometry.centroid.x.round(6)
    df["centroid_lat"] = wgs.geometry.centroid.y.round(6)
    df["geometry_wkt"] = wgs.geometry.to_wkt(rounding_precision=6)
    df = df.reindex(columns=COLUMNS).loc[order].reset_index(drop=True)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    print(f"  wrote {out}: {len(df)} hotspots")
    print(df.groupby(["site_id", "change_class"])["t_area_ha"]
            .agg(["count", "sum"]).round(1).to_string())


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--class-early", required=True)
    ap.add_argument("--class-late", required=True)
    ap.add_argument("--year-early", type=int, default=2017)
    ap.add_argument("--year-late", type=int, default=2025)
    ap.add_argument("--pack", required=True)
    ap.add_argument("--out", default="outputs/hotspots-scoring-input.csv")
    main(ap.parse_args())
