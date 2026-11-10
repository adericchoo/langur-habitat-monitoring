"""Triage scoring: hotspots-scoring-input.csv -> hotspots-scored.csv

Ranks each change patch on four weighted dimensions — threat activity, habitat
value at risk, adjacent exposure, governance leverage — normalising each raw
indicator through a fixed value function, averaging within a dimension, then
combining the four by weighted geometric mean.

Every anchor, weight and ordinal lives in priority_config.yaml, so the same
input and config always produce the same output.

Rows reaching this step have already passed the classifier's confidence gate,
so the ranking is a function of the four dimensions alone.

    python3 score_priority.py                            # default paths
    python3 score_priority.py in.csv out.csv alt.yaml    # alternative weights
"""
import csv, hashlib, math, sys
import yaml

DIMS = {"threat": "T", "value": "V", "exposure": "E", "governance": "G"}


def apply_fn(spec, x):
    if x is None:
        return None
    k = spec["kind"]
    if k == "identity":
        return max(0.0, min(1.0, x))
    if k == "invert":
        return max(0.0, min(1.0, 1 - x))
    if k == "satlog":
        return min(1.0, math.log(1 + x / spec["x0"]) / math.log(1 + spec["xsat"] / spec["x0"]))
    if k == "decay":
        return math.exp(-x / spec["d0"])
    if k == "clamp":
        return max(0.0, min(1.0, (x - spec["lo"]) / (spec["hi"] - spec["lo"])))
    if k == "piecewise":
        pts = sorted(spec["points"])
        if x <= pts[0][0]:
            return pts[0][1]
        if x >= pts[-1][0]:
            return pts[-1][1]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            if x1 <= x <= x2:
                return y1 + (y2 - y1) * (x - x1) / (x2 - x1)
    raise ValueError(f"unknown value function: {k}")


def num(v):
    return None if v in ("", None) else float(v)


def build_indicators(row, cfg):
    """Returns {dimension: {indicator_name: normalised value or None}}."""
    vf, orD = cfg["value_functions"], cfg["ordinals"]
    yr = int(row["run_year"])
    f = lambda name, raw: apply_fn(vf[name], raw)
    o = lambda name, key: orD[name].get(key)

    return {
        "threat": {
            "t_area_ha": f("t_area_ha", num(row["t_area_ha"])),
            "t_rate_ha_yr": f("t_rate_ha_yr", num(row["t_rate_ha_yr"])),
            "t_accel": f("t_accel", num(row["t_accel"])),
            "t_recency_years": f("t_recency_years", yr - int(row["t_first_year"])),
            "t_persist_years": f("t_persist_years", num(row["t_persist_years"])),
        },
        "value": {
            "v_remaining_ha": f("v_remaining_ha", num(row["v_remaining_ha"])),
            "v_canopy_frac": f("v_canopy_frac", num(row["v_canopy_frac"])),
            "v_langur_dist_m": f("v_langur_dist_m", num(row["v_langur_dist_m"])),
            "v_evidence_years": f("v_evidence_years", yr - int(row["v_site_last_record_year"])),
            "v_occupancy": o("v_occupancy", row["v_occupancy"]),
            "v_irrepl": f("v_irrepl", num(row["v_irrepl"])),
        },
        "exposure": {
            "e_adjacent_ha": f("e_adjacent_ha", num(row["e_adjacent_ha"])),
            "e_edge_frac": f("e_edge_frac", num(row["e_edge_frac"])),
            "e_connect_critical": o("e_connect_critical", row["e_connect_critical"]),
        },
        "governance": {
            "g_protected": o("g_protected", row["g_protected"]),
            "g_designation": o("g_designation", row["g_designation"]),
            "g_iucn_cat": o("g_iucn_cat", row["g_iucn_cat"]),
            "g_unlicensed": None if row["g_unlicensed"] == "" else float(row["g_unlicensed"]),
            "g_access_km": f("g_access_km", num(row["g_access_km"])),
        },
    }


def dimension_read(indicators, min_coverage):
    """Mean of the present indicators, equally weighted.

    Returns (read, missing). The read is None where coverage falls below
    min_coverage, so a dimension resting on one surviving indicator is
    reported as unscored.
    """
    present = {k: v for k, v in indicators.items() if v is not None}
    if not present or len(present) / len(indicators) < min_coverage:
        return None, sorted(set(indicators) - set(present))
    return sum(present.values()) / len(present), sorted(set(indicators) - set(present))


def action_for(tier, occupancy, D_threat):
    if occupancy == "historical_unsurveyed" and D_threat is not None and D_threat >= 0.5:
        return "survey_gap"
    return {"P1": "act", "P2": "watch", "P3": "log"}[tier]


def why_string(norm, D, cfg):
    """Top three indicators by their contribution to the composite."""
    W, labels = cfg["dimension_weights"], cfg["indicator_labels"]
    contrib = []
    for dim, inds in norm.items():
        present = [v for v in inds.values() if v is not None]
        if not present:
            continue
        w_each = W[dim] / len(present)
        for name, v in inds.items():
            if v is not None:
                contrib.append((w_each * v, labels.get(name, name), v))
    contrib.sort(reverse=True)
    return "; ".join(f"{lab} ({v:.2f})" for _, lab, v in contrib[:3])


def score(path_in, path_out, path_cfg="priority_config.yaml",
          path_audit="hotspots-scored.csv"):
    cfg = yaml.safe_load(open(path_cfg))
    cfg_hash = "sha256:" + hashlib.sha256(open(path_cfg, "rb").read()).hexdigest()[:8]
    W, eps, thr = cfg["dimension_weights"], cfg["epsilon_floor"], cfg["tier_thresholds"]

    rows = list(csv.DictReader(open(path_in)))
    out = []
    for r in rows:
        norm = build_indicators(r, cfg)
        D, missing = {}, []
        for dim in W:
            D[dim], gaps = dimension_read(norm[dim], cfg["min_dimension_coverage"])
            missing += gaps
        if r["v_occupancy"] == "historical_unsurveyed" and D["value"] is not None:
            D["value"] = max(D["value"], cfg["occupancy_floor"])

        if any(v is None for v in D.values()):
            P, tier, act = None, "unscored", "insufficient_data"
        else:
            P = 100 * math.prod(max(D[d], eps) ** W[d] for d in W)
            tier = "P1" if P >= thr["P1"] else "P2" if P >= thr["P2"] else "P3"
            act = action_for(tier, r["v_occupancy"], D["threat"])

        out.append({
            "hotspot_id": r["hotspot_id"], "site_id": r["site_id"],
            "run_year": r["run_year"], "change_class": r["change_class"],
            **{f"D_{s}": (None if D[d] is None else round(D[d], 3))
               for d, s in DIMS.items()},
            "priority": None if P is None else round(P, 1),
            "tier": tier, "action": act, "why": why_string(norm, D, cfg),
            "missing_indicators": ";".join(sorted(set(missing))),
            "truncated": r["truncated"], "years_of_history": r["years_of_history"],
            "build_run_id": r["build_run_id"], "scoring_config_hash": cfg_hash,
            "weights_elicited": cfg["weights_elicited"],
        })

    out.sort(key=lambda d: (d["priority"] is None, -(d["priority"] or 0)))

    # The deliverable: three columns, ranked.
    with open(path_out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["site_id", "priority", "reasons"])
        for r in out:
            w.writerow([r["site_id"], r["priority"], r["why"]])

    # The audit copy: every dimension read, for the sensitivity analysis and
    # for answering "why is this one above that one".
    with open(path_audit, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)
    return out


if __name__ == "__main__":
    a = sys.argv[1:] or ["hotspots-scoring-input.csv", "priority-areas.csv"]
    res = score(*a)
    print(f"{'site':<22}{'priority':>9}  reasons")
    for r in res:
        print(f"{r['site_id']:<22}{r['priority']:>9}  {r['why']}")
