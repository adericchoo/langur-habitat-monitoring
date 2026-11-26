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
import re
from collections import Counter

import overview as ov

SCHEMA = "policy-dashboard/v1"


def _source(option):
    src = option["sources"][0]
    return {k: src.get(k, "") for k in ("title", "url", "locator", "quote", "checked")}


def _areas(text):
    """The briefs say "patch"; the dashboard says "area" (see _applies_to)."""
    text = re.sub(r"\b([Aa]) patch\b", r"\1n area", text)     # "a patch" -> "an area"
    return re.sub(r"\bpatch(es)?\b", lambda m: "areas" if m.group(1) else "area", text)


def _plain(text):
    """Drops [n] citation markers: the dashboard card shows only the main source."""
    return re.sub(r"\s*\[\d+\]", "", text).strip()


def _next_step(option):
    """(next_step, more): the one thing to do or check, and how many more conditions."""
    grade = option["grade"]
    if grade == "in_place":
        return _areas(ov.cap(option["plain_home_check"])), 0
    if grade == "ready":
        return "Every condition for it holds here.", 0
    wanted = ("not_met",) if grade == "groundwork" else ("unknown", "partial")
    texts = [c["text"] for c in option["conditions"] if c["status"] in wanted]
    return _areas(texts[0] if texts else ""), max(len(texts) - 1, 0)


def _applies_to(groups, total, cfg):
    count = sum(g["patch_count"] for g in groups)
    # "areas", not "patches": this text is read on the dashboard by people
    # who have not seen the scorer.
    if count == total:
        return count, f"All {total} areas"
    parts = [f"{g['patch_count']} {ov.group_label(g['facts'], cfg)}" for g in groups]
    noun = "area" if groups[0]["patch_count"] == 1 else "areas"
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
            # The fields the Policy step's card (PolicyBox) shows: the case's
            # formal name, what it is, why it fits these areas, and its limits.
            "title": o["name"],
            "description": _plain(o["description"]),
            "how_it_fits": _areas(_plain(o["howItFits"])),
            "limitations": _areas(_plain(o["limitations"])),
            "grade": grade,
            "next_step": step, "more_conditions": more,
            "patch_count": count, "applies_to": where,
            "source": _source(o),
            "reviewed_by_svw": o["reviewed_by_svw"],
        })
    return out


def main_driver(brief):
    """The loss driver behind most of the site's patches (e.g. "mining")."""
    counts = Counter()
    for g in brief["groups"]:
        counts[g["facts"]["driver"]] += g["patch_count"]
    return counts.most_common(1)[0][0]


def all_sites(scored, briefs, site_names):
    """Every scored site, briefed or not, with its patch count and best patch.
    Lets the dashboard say something for a site that was not briefed."""
    briefed = {b["site_id"] for b in briefs}
    rows = {}
    for r in scored:
        rows.setdefault(r["site_id"], []).append(r)
    out = []
    for site_id, rs in rows.items():
        ranked = sorted((r for r in rs if r["priority"]), key=lambda r: -float(r["priority"]))
        top = ranked[0] if ranked else None
        out.append({
            "site_id": site_id, "site_name": site_names.get(site_id, site_id),
            "briefed": site_id in briefed,
            "patches": len(rs),
            "by_tier": dict(sorted(Counter(r["tier"] for r in rs).items())),
            "top_priority": float(top["priority"]) if top else None,
            "top_tier": top["tier"] if top else "unscored",
        })
    return sorted(out, key=lambda s: -(s["top_priority"] or 0))


def dashboard_summary(briefs, not_briefed, scored, provenance, caveat, cfg, site_names,
                      inputs_by_id=None):
    tiers = Counter(r["tier"] for r in scored)
    firsts = [int(r["t_first_year"]) for r in (inputs_by_id or {}).values()
              if str(r.get("t_first_year", "")).isdigit()]
    return {
        "schema": SCHEMA,
        "run_year": scored[0]["run_year"] if scored else "",
        # Earliest year a flagged change is dated to: with two classified dates
        # this is the earlier image's year. None when the scorer input is absent.
        "earliest_change_year": str(min(firsts)) if firsts else None,
        "caveat": caveat,
        "bank_version": provenance["bank_version"],
        "run": {
            "patches": len(scored),
            "sites": len({r["site_id"] for r in scored}),
            "by_tier": {t: tiers.get(t, 0) for t in ("P1", "P2", "P3", "unscored") if tiers.get(t)},
        },
        "sites": [{
            "site_id": b["site_id"], "site_name": b["site_name"],
            "driver": main_driver(b),
            "action": b["action"], "brief_type": b["brief_type"],
            "top_priority": b["top_priority"], "top_tier": b["top_tier"],
            "patch_noun": ov.patch_noun(b, cfg),
            "patches": {k: b["patches"][k] for k in ("count", "area_ha", "by_tier")},
            "summary": ov.plain_text(b["overview"]),
            "options": site_options(b, cfg),
            "brief": f"briefs/{b['site_id']}.md",
        } for b in briefs],
        "all_sites": all_sites(scored, briefs, site_names),
        "not_briefed": {
            "patches": not_briefed["count"],
            "sites": [site_names.get(s, s) for s in not_briefed["sites"]],
        },
    }
