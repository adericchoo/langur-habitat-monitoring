"""Per-site risk summary for the dashboard: hotspots-scored.csv -> risk-dashboard.json

The scorer ranks individual patches. The dashboard's Habitat risk step shows
one card per site, so this collapses the scored patches to the site level:
each site is read through its most urgent patch (the same rule the policy
bank uses to rank sites), whose four dimension reads, priority and tier
become the card's dimensions, score and band.

Everything is copied or templated from fields the run already holds — no
model, no new claims — and the file carries no coordinates or geometry
(SECURITY.md). Confidence is reported separately from the score: it is the
share of the scorer's indicators that were present for that patch, so a
high-risk, low-confidence site reads "verify first" and is never demoted.

    python3 risk_summary.py outputs/hotspots-scored.csv outputs/hotspots-scoring-input.csv
"""
import argparse, csv, json, re, sys
from pathlib import Path

import yaml

from score_priority import build_indicators

HERE = Path(__file__).resolve().parent
SCHEMA = "risk-dashboard/v1"
TIER_BAND = {"P1": "high", "P2": "med", "P3": "low"}
DIMENSION_LABELS = {"threat": "Threat activity", "value": "Habitat value at risk",
                    "exposure": "Adjacent exposure", "governance": "Governance leverage"}


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def confidence(row, cfg):
    """How complete the data behind the score is: the count of the scorer's
    indicators that had data for this patch, plus a word for it. A plain
    count, not a statistical confidence level."""
    indicators = build_indicators(row, cfg)
    flat = {name: v for dim in indicators.values() for name, v in dim.items()}
    present, total = sum(v is not None for v in flat.values()), len(flat)
    score = round(present / total, 2)
    label = "High" if score >= 0.75 else "Moderate" if score >= 0.5 else "Low"
    labels = cfg.get("indicator_labels", {})
    missing = sorted(labels.get(n, n) for n, v in flat.items() if v is None)
    return {"score": score, "label": label, "present": present, "total": total,
            "missing": missing,
            "verify_first": row["v_occupancy"] == "historical_unsurveyed"}


def plain_why(why):
    """The scorer's top contributors without the 0-1 reads, as a sentence part:
    "adjacent forest at risk (0.91); expansion rate (1.00)" ->
    "adjacent forest at risk and expansion rate"."""
    parts = [p.strip() for p in re.sub(r"\s*\([\d.]+\)", "", why).split(";") if p.strip()]
    if len(parts) <= 1:
        return "".join(parts)
    return ", ".join(parts[:-1]) + " and " + parts[-1]


def sentences(top, patch_count, run_year):
    """One plain-English line per dimension, from the top patch's own fields."""
    first = top.get("t_first_year") or ""
    period = f"between {first} and {run_year}" if first else f"by {run_year}"
    area, rate = num(top["t_area_ha"]), num(top["t_rate_ha_yr"])
    threat = (f"{patch_count} suspected quarry area{'s' if patch_count != 1 else ''} at this site; "
              f"the most urgent cleared {area:,.1f} ha {period}"
              + (f", about {rate:,.1f} ha a year" if rate else "") + ".")

    rem, dist = num(top["v_remaining_ha"]), num(top["v_langur_dist_m"])
    value = f"About {rem:,.0f} ha of karst forest remain at this site"
    if dist is not None:
        value += f"; the nearest langur record is {dist:,.0f} m from the most urgent area"
    value += "."
    if top["v_occupancy"] == "historical_unsurveyed":
        value += " No recent langur records here: the site is treated as unsurveyed, not as empty."

    adj, edge = num(top["e_adjacent_ha"]), num(top["e_edge_frac"])
    exposure = f"{adj:,.1f} ha of standing forest lies within 250 m of the most urgent area"
    if edge:
        exposure += f", which sits against {edge:.1%} of the site's boundary"
    exposure += "."

    where = {"inside": "inside a protected area", "buffer": "within 1 km of a protected-area boundary",
             "outside": "outside any protected area"}.get(top["g_protected"], "of unknown protection status")
    designation = top.get("g_designation", "")
    governance = f"The most urgent area lies {where}"
    if top["g_protected"] == "inside" and designation not in ("", "none"):
        governance += f" ({designation})"
    governance += "."
    if top.get("g_unlicensed", "") == "":
        governance += " Quarry licence status is not yet known."
    return {"threat": threat, "value": value, "exposure": exposure, "governance": governance}


def site_card(rows, inputs_by_id, cfg, site_names):
    """One site's card, read through its most urgent scored patch."""
    scored = sorted((r for r in rows if r["priority"]), key=lambda r: -float(r["priority"]))
    if not scored:
        return None
    top_audit = scored[0]
    top_input = inputs_by_id.get(top_audit["hotspot_id"])
    if top_input is None:
        raise SystemExit(f"{top_audit['hotspot_id']} is scored but missing from the "
                         "scorer input file; pass the matching hotspots-scoring-input.csv")
    text = sentences(top_input, len(rows), top_audit["run_year"])
    weights = cfg["dimension_weights"]
    dim_cols = {"threat": "D_T", "value": "D_V", "exposure": "D_E", "governance": "D_G"}
    return {
        "site_id": top_audit["site_id"],
        "site_name": site_names.get(top_audit["site_id"], top_audit["site_id"]),
        "patches": len(rows),
        "top_hotspot_id": top_audit["hotspot_id"],
        "priority": float(top_audit["priority"]),
        "action": top_audit["action"],
        "why": plain_why(top_audit["why"]),
        "score": round(float(top_audit["priority"]) / 100, 2),
        "band": TIER_BAND.get(top_audit["tier"], "low"),
        "tier": top_audit["tier"],
        "confidence": confidence(top_input, cfg),
        "dimensions": [{
            "key": dim, "label": DIMENSION_LABELS[dim], "weight": weights[dim],
            "score": num(top_audit[col]),
            "sentence": text[dim],
        } for dim, col in dim_cols.items()],
    }


def risk_summary(scored, inputs, cfg, site_names):
    by_site = {}
    for r in scored:
        by_site.setdefault(r["site_id"], []).append(r)
    inputs_by_id = {r["hotspot_id"]: r for r in inputs}
    cards = [c for c in (site_card(rows, inputs_by_id, cfg, site_names)
                         for rows in by_site.values()) if c]
    cards.sort(key=lambda c: -c["score"])
    firsts = [int(r["t_first_year"]) for r in inputs if str(r.get("t_first_year", "")).isdigit()]
    return {
        "schema": SCHEMA,
        "run_year": scored[0]["run_year"] if scored else "",
        "earliest_change_year": str(min(firsts)) if firsts else None,
        "weights_elicited": bool(cfg.get("weights_elicited")),
        "scoring_config_version": cfg["config_version"],
        "sites": cards,
    }


def load_site_names(path):
    if path and Path(path).exists():
        return yaml.safe_load(Path(path).read_text(encoding="utf-8")).get("site_labels", {})
    return {}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("scored", help="audit file written by score_priority.py")
    ap.add_argument("inputs", help="the scorer's input file, for the sentence fields")
    ap.add_argument("--config", default=str(HERE / "priority_config.yaml"))
    ap.add_argument("--labels", default=str(HERE.parent / "policy-bank" / "policy_config.yaml"),
                    help="config with site_labels (display names)")
    ap.add_argument("--out", default=str(HERE / "outputs" / "risk-dashboard.json"))
    a = ap.parse_args()
    cfg = yaml.safe_load(Path(a.config).read_text(encoding="utf-8"))
    summary = risk_summary(read_csv(a.scored), read_csv(a.inputs), cfg, load_site_names(a.labels))
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for c in summary["sites"]:
        print(f"{c['site_name']:<22}{c['score']:>6}  {c['band']:<5}"
              f"confidence {c['confidence']['score']} ({c['confidence']['label']})"
              + ("  verify first" if c["confidence"]["verify_first"] else ""))
    print(f"-> {out}", file=sys.stderr)
