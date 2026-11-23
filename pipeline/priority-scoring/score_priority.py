"""Triage scoring: hotspots-scoring-input.csv -> priority-areas.csv/.json

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

Writes three files into the folder of out.csv:
    priority-areas.csv    the ranked deliverable (hotspot_id, site, priority, reasons)
    priority-areas.json   the same ranking with provenance, a per-site summary
                          and structured reasons, for the dashboard / policy bank
    hotspots-scored.csv   the wide audit copy with every dimension read
"""
import csv, hashlib, json, math, sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
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


def reliability_weighted(proximity, reliability, vf):
    """Closeness to a langur record, discounted by how good that record is.

    A patch 300 m from an interview report is weaker evidence than one 300 m
    from a drone-confirmed group. A missing reliability leaves proximity as is.
    """
    if proximity is None or reliability is None:
        return proximity
    return proximity * apply_fn(vf["record_reliability"], reliability)


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
            "v_langur_dist_m": reliability_weighted(
                f("v_langur_dist_m", num(row["v_langur_dist_m"])),
                num(row.get("record_reliability")), vf),
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


def why_parts(norm, D, cfg):
    """Top three indicators by their contribution to the composite.

    Returns [(indicator, dimension, label, normalised value)], largest first.
    """
    W, labels = cfg["dimension_weights"], cfg["indicator_labels"]
    contrib = []
    for dim, inds in norm.items():
        present = [v for v in inds.values() if v is not None]
        if not present:
            continue
        w_each = W[dim] / len(present)
        for name, v in inds.items():
            if v is not None:
                contrib.append((w_each * v, name, dim, labels.get(name, name), v))
    contrib.sort(reverse=True)
    return [(name, dim, lab, v) for _, name, dim, lab, v in contrib[:3]]


def why_string(parts):
    return "; ".join(f"{lab} ({v:.2f})" for _, _, lab, v in parts)


def score(path_in, path_out, path_cfg="priority_config.yaml",
          path_audit=None, path_json=None):
    """Writes three outputs next to path_out unless told otherwise:
    the ranked deliverable (CSV), the same ranking as JSON, and the wide
    audit CSV with every dimension read."""
    path_audit = path_audit or str(Path(path_out).with_name("hotspots-scored.csv"))
    path_json = path_json or str(Path(path_out).with_suffix(".json"))
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

        parts = why_parts(norm, D, cfg)
        out.append({
            "_reasons": parts, "_D": D,
            "hotspot_id": r["hotspot_id"], "site_id": r["site_id"],
            "run_year": r["run_year"], "change_class": r["change_class"],
            **{f"D_{s}": (None if D[d] is None else round(D[d], 3))
               for d, s in DIMS.items()},
            "priority": None if P is None else round(P, 1),
            "tier": tier, "action": act, "why": why_string(parts),
            "missing_indicators": ";".join(sorted(set(missing))),
            "truncated": r["truncated"], "years_of_history": r["years_of_history"],
            "build_run_id": r["build_run_id"], "scoring_config_hash": cfg_hash,
            "weights_elicited": cfg["weights_elicited"],
        })

    out.sort(key=lambda d: (d["priority"] is None, -(d["priority"] or 0)))

    # The deliverable: four columns, ranked.
    with open(path_out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["hotspot_id", "site_id", "priority", "reasons"])
        for r in out:
            w.writerow([r["hotspot_id"], r["site_id"], r["priority"], r["why"]])

    # The audit copy: every dimension read, for the sensitivity analysis and
    # for answering "why is this one above that one".
    audit_cols = [k for k in out[0] if not k.startswith("_")]
    with open(path_audit, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=audit_cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(out)

    # The same ranking as JSON, for the dashboard and the policy-bank step:
    # a provenance header, a summary, and one object per hotspot with
    # structured reasons. Like the CSVs, it carries no coordinates.
    write_json(out, path_json, cfg, cfg_hash)
    return out


def write_json(out, path_json, cfg, cfg_hash):
    def num_or_none(v, cast):
        return None if v in ("", None) else cast(v)

    by_site = {}
    for r in out:
        s = by_site.setdefault(r["site_id"], {
            "hotspots": 0, "P1": 0, "P2": 0, "P3": 0, "unscored": 0,
            "top_priority": None, "top_hotspot_id": None})
        s["hotspots"] += 1
        s[r["tier"]] += 1
        if r["priority"] is not None and (s["top_priority"] is None
                                          or r["priority"] > s["top_priority"]):
            s["top_priority"], s["top_hotspot_id"] = r["priority"], r["hotspot_id"]

    doc = {
        "schema": "priority-areas/v1",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "provenance": {
            "config_version": cfg.get("config_version"),
            "scoring_config_hash": cfg_hash,
            "weights_elicited": cfg["weights_elicited"],
            "build_run_ids": sorted({r["build_run_id"] for r in out}),
            "dimension_weights": cfg["dimension_weights"],
            "tier_thresholds": cfg["tier_thresholds"],
        },
        "summary": {
            "hotspots": len(out),
            "by_tier": dict(Counter(r["tier"] for r in out)),
            "by_action": dict(Counter(r["action"] for r in out)),
            "by_site": dict(sorted(by_site.items(),
                                   key=lambda kv: -(kv[1]["top_priority"] or 0))),
        },
        "hotspots": [
            {
                "rank": i + 1,
                "hotspot_id": r["hotspot_id"],
                "site_id": r["site_id"],
                "run_year": num_or_none(r["run_year"], int),
                "change_class": r["change_class"],
                "priority": r["priority"],
                "tier": r["tier"],
                "action": r["action"],
                "reasons": [
                    {"indicator": name, "dimension": dim, "label": lab,
                     "value": round(v, 2)}
                    for name, dim, lab, v in r["_reasons"]],
                "dimensions": {d: (None if v is None else round(v, 3))
                               for d, v in r["_D"].items()},
                "missing_indicators": [m for m in r["missing_indicators"].split(";") if m],
                "truncated": str(r["truncated"]).upper() == "TRUE",
                "years_of_history": num_or_none(r["years_of_history"], int),
            }
            for i, r in enumerate(out)
        ],
    }
    with open(path_json, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    a = sys.argv[1:] or ["hotspots-scoring-input.csv", "priority-areas.csv"]
    res = score(*a)
    print(f"{'hotspot':<13}{'site':<22}{'priority':>9}  reasons")
    for r in res:
        print(f"{r['hotspot_id']:<13}{r['site_id']:<22}{r['priority']:>9}  {r['why']}")
    out_csv = a[1]
    print(f"\nwrote {out_csv}, {Path(out_csv).with_suffix('.json')}, "
          f"{Path(out_csv).with_name('hotspots-scored.csv')}")
