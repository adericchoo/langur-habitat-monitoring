"""Compact policy summary for the dashboard: policy-briefs -> policy-dashboard.json

The full briefs are written for a report. The dashboard's Policy step has a
narrow sidebar, so it gets a smaller file: per briefed site, the headline
numbers and the same few options the plain-English overview names, each with
its grade, one next step and its main source.

Nothing new is written here. Every string is copied from a field the run
already holds (the case's plain_name and plain_use, the precondition texts,
the first source), so the dashboard says what the briefs say, in fewer words.

    dashboard_summary(briefs, not_briefed, scored, provenance, caveat, cfg)
"""
from collections import Counter

import overview as ov

SCHEMA = "policy-dashboard/v1"


def _source(option):
    src = option["sources"][0]
    return {k: src.get(k, "") for k in ("title", "url", "locator", "quote", "checked")}


def _next_step(option):
    """(next_step, more): the one thing to do or check, and how many more conditions."""
    grade = option["grade"]
    if grade == "in_place":
        return ov.cap(option["plain_home_check"]), 0
    if grade == "ready":
        return "Every condition for it holds here.", 0
    wanted = ("not_met",) if grade == "groundwork" else ("unknown", "partial")
    texts = [c["text"] for c in option["conditions"] if c["status"] in wanted]
    return (texts[0] if texts else ""), max(len(texts) - 1, 0)


def _applies_to(groups, total, cfg):
    count = sum(g["patch_count"] for g in groups)
    if count == total:
        return count, f"All {total} patches"
    parts = [f"{g['patch_count']} {ov.group_label(g['facts'], cfg)}" for g in groups]
    noun = "patch" if groups[0]["patch_count"] == 1 else "patches"
    parts[0] = parts[0].replace(" ", f" {noun} ", 1)
    return count, ov.join(parts)


def site_options(brief, cfg):
    """The options the overview names for this site, one entry per (case, grade).

    A site with one group shows its first `overview_options_single` options; a
    site whose patches split into groups shows the first
    `overview_options_per_group` of each, and an option that recurs across
    groups with the same grade is listed once, covering all those patches.
    """
    groups = brief["groups"]
    per = cfg["overview_options_single"] if len(groups) == 1 else cfg["overview_options_per_group"]
    merged = {}
    for g in groups:
        for o in g["options"][:per]:
            entry = merged.setdefault((o["case_id"], o["grade"]), {"option": o, "groups": []})
            entry["groups"].append(g)
    out = []
    for (case_id, grade), entry in merged.items():
        o = entry["option"]
        count, where = _applies_to(entry["groups"], brief["patches"]["count"], cfg)
        step, more = _next_step(o)
        out.append({
            "id": f"{brief['site_id']}:{case_id}",
            "case_id": case_id, "kind": o["kind"], "country": o["country"],
            "name": ov.cap(o["plain_home_name"] if grade == "in_place" else o["plain_name"]),
            "does": ("Already in place at this site." if grade == "in_place"
                     else ov.cap(o["plain_use"]) + "."),
            "grade": grade,
            "next_step": step, "more_conditions": more,
            "patch_count": count, "applies_to": where,
            "source": _source(o),
            "reviewed_by_svw": o["reviewed_by_svw"],
        })
    return out


def dashboard_summary(briefs, not_briefed, scored, provenance, caveat, cfg, site_names):
    tiers = Counter(r["tier"] for r in scored)
    return {
        "schema": SCHEMA,
        "run_year": scored[0]["run_year"] if scored else "",
        "caveat": caveat,
        "bank_version": provenance["bank_version"],
        "run": {
            "patches": len(scored),
            "sites": len({r["site_id"] for r in scored}),
            "by_tier": {t: tiers.get(t, 0) for t in ("P1", "P2", "P3", "unscored") if tiers.get(t)},
        },
        "sites": [{
            "site_id": b["site_id"], "site_name": b["site_name"],
            "action": b["action"], "brief_type": b["brief_type"],
            "top_priority": b["top_priority"], "top_tier": b["top_tier"],
            "patch_noun": ov.patch_noun(b, cfg),
            "patches": {k: b["patches"][k] for k in ("count", "area_ha", "by_tier")},
            "summary": ov.plain_text(b["overview"]),
            "options": site_options(b, cfg),
            "brief": f"briefs/{b['site_id']}.md",
        } for b in briefs],
        "not_briefed": {
            "patches": not_briefed["count"],
            "sites": [site_names.get(s, s) for s in not_briefed["sites"]],
        },
    }
