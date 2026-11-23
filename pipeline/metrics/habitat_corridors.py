"""Part B of the corridor method: least-cost corridors between habitat patches.

See corridor-method.md (local, gitignored). Part A (habitat_patches.py) turns the
classification raster into discrete patches; Part B takes those patches as graph
nodes and draws the least-cost link between near neighbours, then classifies each
link intact / partial / lost.

Pipeline (B-steps mirror corridor-method.md "Part B — Build corridors"):
  (re-derive patches exactly as Part A: P1 mask -> P2 denoise -> P3 8-label ->
   P4 require a core -> P5 --min-ha; patch ids match habitat_patches.py output)
  B1  distance cap      only consider patch pairs within DIST_CAP_M edge-to-edge
  B2  nearest-neighbour keep each patch's N_NEIGHBORS closest (edge-to-edge) links
  B3  least-cost path   Dijkstra over a per-class RESISTANCE surface, edge to edge
  B4  (thicken)         display-only — the web renders its own corridor width; not used here
  B5  classify          intact / partial / lost on the path CENTERLINE (length-weighted):
                        metres of hard barrier crossed + mean resistance, not a band share

SCREENING, NOT PROOF — a corridor is a *plausible* least-cost connection from
land-cover class, not a field-verified route.

SENSITIVE OUTPUT: corridor paths are precise habitat geometry (same tier as the
patches). The GeoJSON is written under pipeline/metrics/outputs/ (gitignored).
Local/dev visualisation only; never commit or publish the raw geometry. See CLAUDE.md.

Pure numpy + rasterio (no scipy/skimage), matching habitat_patches.py / habitat_loss.py.

Usage (repo root, inside the venv):
    python -I pipeline/metrics/habitat_corridors.py \
        --raster docs/classification_v2_2025.tif \
        --out    pipeline/metrics/outputs/habitat_corridors_2025.geojson
Defaults match those paths. --min-ha mirrors Part A P5 (0 keeps every cored patch).
"""
from __future__ import annotations

import argparse
import collections
import heapq
import json
import math
import os
import time

import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from rasterio.warp import transform_geom
from rasterio.windows import Window
from rasterio.windows import transform as window_transform

# --- Patch formation (mirror habitat_patches.py Part A — keep in sync) --------
HABITAT_CLASS = 2      # 2 = Karst forest = langur habitat (v2 legend, confirmed)
EDGE_DEPTH_M = 100     # P4 core erosion depth; == habitat_loss / fragmentation core
CONNECTIVITY = 8       # P3 — decided

# --- v2 class legend (confirmed with the GEE author) --------------------------
# NOTE: this is the NEW 6-class scheme and deliberately does NOT reuse
# habitat_loss.CLASS_NAMES (that is the older 4-class legend). Only HABITAT_CLASS
# happens to still be 2 in both.
CLASS_NAMES = {
    0: "nodata", 1: "forest", 2: "karst_forest", 3: "quarry",
    4: "agriculture", 5: "urban", 6: "other",
}

# --- Resistance surface (B3) — cost to MOVE THROUGH each class ----------------
# DOMAIN CALLS — placeholders, tune with SVW. Lower = easier to traverse.
# Karst forest (habitat) is cheapest; quarry hardest; nodata/outside impassable.
RESISTANCE = {
    2: 1.0,     # karst forest (habitat) — easiest
    1: 3.0,     # forest
    4: 15.0,    # agriculture — moderate
    6: 40.0,    # other (water, etc.) — hard
    5: 60.0,    # urban (buildings) — very hard
    3: 100.0,   # quarry — hardest
    0: math.inf,  # nodata / outside study area — impassable
}

# --- Corridor graph knobs (B1/B2) — domain calls ------------------------------
DIST_CAP_M = 5000.0    # B1 — no corridor proposed beyond 5 km edge-to-edge
N_NEIGHBORS = 3        # B2 — keep each patch's 3 nearest neighbours
CENTROID_PREFILTER = 12  # cheap centroid pre-rank before exact edge-to-edge
BOUNDARY_SUBSAMPLE = 1500  # cap boundary pixels used for edge-to-edge distance
WINDOW_MARGIN_M = 600.0  # pad the per-pair search window to let paths bow around barriers
# Stepping-stone rule: when a least-cost path to B first passes through a nearer
# patch C, that C is the true (cost-distance) nearest neighbour — langurs hop via
# it — so the link is TRUNCATED to A->C. The C->B leg is found when C is routed.
# A 1px graze of a patch corner shouldn't trigger it, so require this much inside C.
THROUGH_PATCH_TOL_M = 30.0

# --- Classification (B5) — domain calls, tune with SVW ------------------------
# Classified on the path CENTERLINE (length-weighted), NOT a thick band. The
# least-cost router already dodges barriers, so a band's barrier *share* badly
# understates how much a corridor is forced to cross (the band is mostly the
# habitat flanking the line). We instead measure what the cheapest route must
# cut through. Deliberately strict; loosen/tighten with SVW.
GOOD_CLASSES = {1, 2}        # forest + karst forest (low-cost habitat)
BARRIER_CLASSES = {3, 5, 6}  # quarry / urban / water-ish — hard barriers
# "Lost" keys off the longest CONTIGUOUS barrier run (a real unbroken strip the
# animal must cross), NOT total barrier metres — on a long corridor, scattered
# barrier pixels summed into a big total and condemned mostly-habitat routes.
LOST_BARRIER_RUN_M = 60.0    # a single unbroken barrier strip this wide -> lost
LOST_BARRIER_FRAC = 0.20     # or >= this share of length on barrier -> lost
LOST_MEAN_RES = 25.0         # or mean resistance/px this high (mostly hostile) -> lost
INTACT_GOOD_FRAC = 0.80      # >= this share habitat, with only incidental barrier:
INTACT_MAX_RUN_M = 20.0      #   no barrier strip wider than this, and
INTACT_MAX_BARRIER_FRAC = 0.05  #   barrier under this share -> intact


def binary_erosion(mask, iterations):
    """4-connected binary erosion by `iterations` px (mirrors habitat_patches.py)."""
    m = mask
    for _ in range(iterations):
        e = m.copy()
        e[1:, :] &= m[:-1, :]
        e[:-1, :] &= m[1:, :]
        e[:, 1:] &= m[:, :-1]
        e[:, :-1] &= m[:, 1:]
        e[0, :] = e[-1, :] = e[:, 0] = e[:, -1] = False
        m = e
    return m


def binary_dilation(mask, iterations):
    """4-connected binary dilation by `iterations` px (mirrors habitat_patches.py)."""
    m = mask
    for _ in range(iterations):
        d = m.copy()
        d[1:, :] |= m[:-1, :]
        d[:-1, :] |= m[1:, :]
        d[:, 1:] |= m[:, :-1]
        d[:, :-1] |= m[:, 1:]
        m = d
    return m


def build_patches(classes, px_m, min_ha, log):
    """Re-derive Part A patches, returning a label raster + the kept patch ids.

    Identical to habitat_patches.py P1-P5 so ids match that script's GeoJSON.
    """
    px_area_ha = (px_m * px_m) / 10_000.0
    iters = max(1, round(EDGE_DEPTH_M / px_m))

    forest = classes == HABITAT_CLASS                                   # P1
    cleaned = binary_dilation(binary_erosion(forest, 1), 1)            # P2 open
    cleaned = binary_erosion(binary_dilation(cleaned, 1), 1)          # P2 close
    core = binary_erosion(cleaned, iters)                             # P4 mask
    log(f"P1/P2 habitat pixels (denoised): {int(cleaned.sum()):,}")

    geoms = [g for g, _ in shapes(cleaned.astype(np.uint8), mask=cleaned,     # P3
                                  connectivity=CONNECTIVITY)]
    n = len(geoms)
    labels = rasterize(((g, i) for i, g in enumerate(geoms, start=1)),
                       out_shape=classes.shape, fill=0, dtype=np.int32)
    log(f"P3 candidate patches (8-connected): {n:,}")

    area_px = np.bincount(labels.ravel(), minlength=n + 1)
    core_px = np.bincount(labels[core].ravel(), minlength=n + 1)
    has_core = core_px[1:] > 0                                        # P4
    big = (area_px[1:] * px_area_ha) >= min_ha                        # P5
    kept = np.nonzero(has_core & big)[0] + 1                          # 1-based ids
    log(f"P4/P5 kept patches (core AND >= {min_ha} ha): {kept.size:,}")
    return labels, kept, area_px


def patch_boundaries(labels, kept):
    """Per-patch boundary pixel coords (row, col) and centroid, in raster space.

    A boundary pixel is a patch pixel with a 4-neighbour that is not the same
    patch (background or a different patch). Returns dicts keyed by patch id.
    """
    lab = labels
    interior = lab > 0
    # a pixel is interior only if all 4 orthogonal neighbours share its label
    same = np.ones_like(interior)
    same[1:, :] &= lab[1:, :] == lab[:-1, :]
    same[:-1, :] &= lab[:-1, :] == lab[1:, :]
    same[:, 1:] &= lab[:, 1:] == lab[:, :-1]
    same[:, :-1] &= lab[:, :-1] == lab[:, 1:]
    same[0, :] = same[-1, :] = same[:, 0] = same[:, -1] = False
    boundary = interior & ~same

    brow, bcol = np.nonzero(boundary)
    blab = lab[brow, bcol]
    order = np.argsort(blab, kind="stable")
    blab, brow, bcol = blab[order], brow[order], bcol[order]
    # split sorted boundary arrays into per-label slices
    edges, cents = {}, {}
    starts = np.searchsorted(blab, kept, side="left")
    ends = np.searchsorted(blab, kept, side="right")
    for pid, s, e in zip(kept, starts, ends):
        r, c = brow[s:e], bcol[s:e]
        edges[int(pid)] = (r, c)
        cents[int(pid)] = (float(r.mean()), float(c.mean()))
    return edges, cents


def _subsample(r, c, cap):
    if r.size <= cap:
        return r, c
    idx = np.linspace(0, r.size - 1, cap).astype(np.intp)
    return r[idx], c[idx]


def edge_to_edge(a, b, px_m, cap):
    """Min edge-to-edge distance (m) between two patches and the closest pixel pair."""
    ar, ac = _subsample(a[0], a[1], cap)
    br, bc = _subsample(b[0], b[1], cap)
    # pairwise squared pixel distance via broadcasting (capped, so bounded memory)
    d2 = (ar[:, None] - br[None, :]) ** 2 + (ac[:, None] - bc[None, :]) ** 2
    k = int(np.argmin(d2))
    i, j = divmod(k, br.size)
    dist = math.sqrt(float(d2[i, j])) * px_m
    return dist, (int(ar[i]), int(ac[i])), (int(br[j]), int(bc[j]))


def candidate_links(kept, edges, cents, px_m, log):
    """B1+B2: for each patch, its <=N_NEIGHBORS nearest within DIST_CAP_M.

    Returns a dict (a,b)->(dist, pA, pB) for undirected unique links.
    """
    ids = list(kept)
    cen = np.array([cents[i] for i in ids])  # (n,2) row,col
    links = {}
    for ii, a in enumerate(ids):
        # cheap centroid pre-rank, then exact edge-to-edge on the closest few
        d = np.hypot(cen[:, 0] - cen[ii, 0], cen[:, 1] - cen[ii, 1])
        d[ii] = np.inf
        cand = np.argsort(d)[:CENTROID_PREFILTER]
        scored = []
        for jj in cand:
            b = ids[jj]
            dist, pA, pB = edge_to_edge(edges[a], edges[b], px_m, BOUNDARY_SUBSAMPLE)
            if dist <= DIST_CAP_M:
                scored.append((dist, b, pA, pB))
        scored.sort(key=lambda t: t[0])
        for dist, b, pA, pB in scored[:N_NEIGHBORS]:
            key = (min(a, b), max(a, b))
            if key not in links or dist < links[key][0]:
                links[key] = (dist, pA, pB) if a < b else (dist, pB, pA)
    log(f"B1/B2 candidate links (<= {DIST_CAP_M:g} m, {N_NEIGHBORS} nearest): {len(links):,}")
    return links


# 8-neighbour offsets and geometric step factors (orthogonal 1, diagonal sqrt2)
_SQ2 = math.sqrt(2)
_OFFS = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
         (-1, -1, _SQ2), (-1, 1, _SQ2), (1, -1, _SQ2), (1, 1, _SQ2)]


def least_cost_path(res, starts, targets):
    """Dijkstra over a resistance window. Multi-source from `starts` (cost 0).

    res: (h,w) float cost per pixel (inf = impassable).
    starts/targets: bool masks on the same window.
    Returns a list of (row,col) path pixels start->target, or None if unreachable.

    Pure-Python lists (not numpy scalar indexing) in the hot loop — ~10x faster.
    """
    h, w = res.shape
    n = h * w
    INF = float("inf")
    resf = res.ravel().tolist()
    tflat = targets.ravel().tolist()
    dist = [INF] * n
    prev = [-1] * n
    pq = []
    push, pop = heapq.heappush, heapq.heappop
    sr, sc = np.nonzero(starts)
    for r, c in zip(sr.tolist(), sc.tolist()):
        fi = r * w + c
        if resf[fi] != INF:
            dist[fi] = 0.0
            push(pq, (0.0, fi))

    hit = -1
    while pq:
        d, fi = pop(pq)
        if d > dist[fi]:
            continue
        if tflat[fi]:
            hit = fi
            break
        r = fi // w
        c = fi - r * w
        ci = resf[fi]
        for dr, dc, fac in _OFFS:
            nr = r + dr
            nc = c + dc
            if nr < 0 or nr >= h or nc < 0 or nc >= w:
                continue
            nj = nr * w + nc
            cj = resf[nj]
            if cj == INF:
                continue
            nd = d + fac * 0.5 * (ci + cj)
            if nd < dist[nj]:
                dist[nj] = nd
                prev[nj] = fi
                push(pq, (nd, nj))
    if hit < 0:
        return None, math.inf
    path = []
    fi = hit
    while fi != -1:
        path.append((fi // w, fi - (fi // w) * w))
        fi = prev[fi]
    path.reverse()
    return path, dist[hit]


def path_cost(res, path):
    """Accumulated least-cost of a (possibly truncated) path over window `res`.

    Mirrors the Dijkstra step cost fac*0.5*(ci+cj), so a truncated prefix can be
    re-scored without re-running the search.
    """
    tot = 0.0
    for (r0, c0), (r1, c1) in zip(path, path[1:]):
        fac = _SQ2 if (r0 != r1 and c0 != c1) else 1.0
        tot += fac * 0.5 * (res[r0, c0] + res[r1, c1])
    return tot


def truncate_at_stepping_stone(path, lab_w, a, b, tol_px, kept_set):
    """If the path passes >tol_px through a nearer KEPT patch C before reaching B,
    cut it to A->C and return (truncated_path, C). Otherwise return (path, b).

    Only patches in `kept_set` count as stepping stones — the label raster also
    holds the sub-threshold components Part A rejected (no core / too small), and a
    langur can't stage through a patch we deemed non-viable, so the route passes
    through those as ordinary habitat. B appears only as the final pixel (the search
    stops on first reaching it), so a multi-pixel run can only be a tunnelled patch.
    """
    cur = 0
    run = 0
    entry = 0
    for i, (r, c) in enumerate(path):
        lv = int(lab_w[r, c])
        if lv == a or lv not in kept_set:  # own patch, background, or rejected sliver
            cur = run = 0
            continue
        if lv != cur:
            cur, run, entry = lv, 1, i
        else:
            run += 1
        if lv != b and run >= tol_px:   # a genuine third kept-patch crossing
            return path[:entry + 1], lv
    return path, b


def classify_corridor(classes_win, path, px_m, cost):
    """B5: classify on the path CENTERLINE, length-weighted (strict).

    Measures what the cheapest route is forced to traverse: the longest CONTIGUOUS
    run of hard barrier (an unbroken strip the animal must cross), the total barrier
    share, the habitat share, and the mean resistance per unit length. A corridor is
    'lost' when the best route must cut an unbroken barrier strip, is heavily barrier
    overall, or averages hostile land; 'intact' only when it is mostly habitat with
    no more than an incidental barrier clip. Returns (status, good_frac, barrier_frac,
    barrier_m, barrier_run_m, mean_res).
    """
    total_m = good_m = barrier_m = 0.0
    run_m = max_run_m = 0.0
    for (r0, c0), (r1, c1) in zip(path, path[1:]):
        step = px_m * (_SQ2 if (r0 != r1 and c0 != c1) else 1.0)
        total_m += step
        cls = int(classes_win[r1, c1])  # class of the cell the step enters
        if cls in BARRIER_CLASSES:
            barrier_m += step
            run_m += step
            if run_m > max_run_m:
                max_run_m = run_m
        else:
            run_m = 0.0  # habitat OR agriculture breaks a contiguous barrier run
            if cls in GOOD_CLASSES:
                good_m += step
    if total_m == 0.0:
        return "lost", 0.0, 0.0, 0.0, 0.0, 0.0
    good_frac = good_m / total_m
    barrier_frac = barrier_m / total_m
    path_len_px = total_m / px_m
    mean_res = cost / path_len_px if path_len_px else 0.0  # ~1 for pure habitat
    if (max_run_m >= LOST_BARRIER_RUN_M or barrier_frac >= LOST_BARRIER_FRAC
            or mean_res >= LOST_MEAN_RES):
        status = "lost"
    elif (good_frac >= INTACT_GOOD_FRAC and max_run_m <= INTACT_MAX_RUN_M
          and barrier_frac <= INTACT_MAX_BARRIER_FRAC):
        status = "intact"
    else:
        status = "partial"
    return (status, round(good_frac, 3), round(barrier_frac, 3),
            round(barrier_m, 1), round(max_run_m, 1), round(mean_res, 2))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raster", default="docs/classification_v2_2025.tif")
    ap.add_argument("--out", default="pipeline/metrics/outputs/habitat_corridors_2025.geojson")
    ap.add_argument("--min-ha", type=float, default=0.0,
                    help="P5 minimum patch size in hectares; 0 keeps every cored patch")
    args = ap.parse_args()

    t0 = time.time()

    def log(msg):
        print(f"[{time.time() - t0:5.1f}s] {msg}", flush=True)

    with rasterio.open(args.raster) as ds:
        px_m = abs(ds.res[0])
        transform = ds.transform
        crs = ds.crs.to_string()
        classes = ds.read(1).astype(np.int16)
        log(f"raster {ds.width}x{ds.height}  {px_m:g} m  crs={crs}")

    labels, kept, _area = build_patches(classes, px_m, args.min_ha, log)
    if kept.size < 2:
        log("fewer than 2 patches — no corridors to build.")
        _write(args.out, [], crs, log)
        return

    edges, cents = patch_boundaries(labels, kept)
    links = candidate_links(kept, edges, cents, px_m, log)

    # Resistance lookup table indexed by class code (0..max) -> cost.
    maxc = int(max(CLASS_NAMES))
    lut = np.full(maxc + 1, np.inf, dtype=np.float64)
    for code, cost in RESISTANCE.items():
        if code <= maxc:
            lut[code] = cost

    margin_px = int(round(WINDOW_MARGIN_M / px_m))
    H, W = classes.shape

    tol_px = max(1, round(THROUGH_PATCH_TOL_M / px_m))
    kept_set = set(int(x) for x in kept)   # only viable patches are stepping stones
    feats = {}  # (min_id, max_id) -> feature; dedup, keep the shortest hop
    counts = {"unreachable": 0, "skipped": 0, "truncated": 0}
    CELL_CAP = 4_000_000  # guard: skip a pathological window rather than stall
    for n_done, ((a, b), (dist, pA, pB)) in enumerate(sorted(links.items()), 1):
        # Per-pair window around the closest-point pair (bounds mega-patches too).
        # The endpoints already span the gap; pad only for path bowing room.
        pad = margin_px
        r0 = max(0, min(pA[0], pB[0]) - pad)
        r1 = min(H, max(pA[0], pB[0]) + pad + 1)
        c0 = max(0, min(pA[1], pB[1]) - pad)
        c1 = min(W, max(pA[1], pB[1]) + pad + 1)
        if (r1 - r0) * (c1 - c0) > CELL_CAP:
            counts["skipped"] += 1
            continue
        lab_w = labels[r0:r1, c0:c1]
        cls_w = classes[r0:r1, c0:c1]
        res_w = lut[np.clip(cls_w, 0, maxc)]

        path, cost = least_cost_path(res_w, lab_w == a, lab_w == b)
        if path is None:
            counts["unreachable"] += 1
            continue

        # Stepping-stone rule: if the path tunnels through a nearer patch C before B,
        # truncate to the real hop A->C (langurs hop via C; C->B is found from C).
        path, tgt = truncate_at_stepping_stone(path, lab_w, a, b, tol_px, kept_set)
        if tgt != b:
            counts["truncated"] += 1
            cost = path_cost(res_w, path)   # re-score the shortened hop

        key = (min(a, tgt), max(a, tgt))
        status, good, barrier, barrier_m, barrier_run, mean_res = classify_corridor(
            cls_w, path, px_m, cost)

        # path pixels (window) -> world coords -> lon/lat LineString
        wt = window_transform(Window(c0, r0, c1 - c0, r1 - r0), transform)
        coords = [wt * (c + 0.5, r + 0.5) for r, c in path]  # (x, y) UTM
        length_m = sum(math.dist(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
        if key in feats and feats[key]["properties"]["length_m"] <= length_m:
            continue  # keep the shorter hop for this patch pair
        line = {"type": "LineString", "coordinates": [list(xy) for xy in coords]}
        line = transform_geom(crs, "EPSG:4326", line)
        feats[key] = {
            "type": "Feature",
            "geometry": line,
            "properties": {
                "from_id": int(key[0]), "to_id": int(key[1]), "status": status,
                "gap_m": round(float(math.dist(coords[0], coords[-1])), 1),
                "length_m": round(float(length_m), 1),
                "pct_habitat": good, "pct_barrier": barrier,
                "barrier_m": barrier_m, "barrier_run_m": barrier_run,
                "mean_resistance": mean_res,
            },
        }
        if n_done % 100 == 0:
            log(f"  routed {n_done:,}/{len(links):,} links")

    features = list(feats.values())
    status_counts = collections.Counter(f["properties"]["status"] for f in features)
    log(f"B3/B5 corridors: intact={status_counts['intact']}  partial={status_counts['partial']}  "
        f"lost={status_counts['lost']}  | truncated to nearer patch={counts['truncated']}  "
        f"unreachable={counts['unreachable']}  skipped={counts['skipped']}  "
        f"(unique links after dedup: {len(features)})")
    _write(args.out, features, crs, log)


def _write(out, features, crs, log):
    fc = {"type": "FeatureCollection",
          "name": f"habitat_corridors (cap={DIST_CAP_M:g}m, k={N_NEIGHBORS})",
          "features": features}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(fc, f)
    log(f"wrote {len(features):,} corridors -> {out}")
    print("\nSENSITIVE geometry — local only, do not commit/publish (see CLAUDE.md).")


if __name__ == "__main__":
    main()
