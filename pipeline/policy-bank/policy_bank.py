"""Policy bank: hotspots-scored.csv -> policy-briefs.json + one brief per site

Takes the sites with the highest-priority hotspots from the priority scorer
and, for each, lists the policy options a manager could raise, drawn from a
curated bank of cases (policy_cases.yaml).

Policies act on a site or a province, not on one patch of cleared forest, and
a site can carry dozens of flagged patches. So a brief covers one site. Its
patches are grouped by the attributes matching reads (loss driver, protection,
licence, langur evidence); every patch in a group gets the same options by
construction, so each group is matched once.

Three steps, all rule-based:

  select    the top sites, ranked by their highest-priority patch, plus a
            count of the rest
  match     each case's eligibility switches against each group's attributes,
            then a transferability grade from the case's preconditions. A case
            already in place at this site (its home site) is graded "in place"
            and worded as a check on whether it is working.
  brief     a Markdown brief per site and one JSON file for the dashboard

The scorer's audit file carries the ranking; the hotspot attributes the
matching reads (protection status, licence status, occupancy) come from the
scorer's own input file, joined on hotspot_id.

Every tunable lives in policy_config.yaml and every case in policy_cases.yaml,
so the same inputs always produce the same briefs.

    python3 policy_bank.py                                   # default paths
    python3 policy_bank.py --scored a.csv --inputs b.csv --out outputs
    python3 policy_bank.py --narrate                         # adds a model-written summary
"""
import argparse, csv, hashlib, json, sys
from collections import Counter
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
GRADE_ORDER = ["in_place", "ready", "confirm", "groundwork"]
ACTION_URGENCY = ["act", "survey_gap", "watch", "log"]
ATTRIBUTES = ["g_protected", "g_designation", "g_unlicensed", "v_occupancy"]
SWITCH_NAMES = {"driver": "loss driver", "g_protected": "protection status",
                "licence": "licence status", "v_occupancy": "langur evidence"}


def file_hash(path):
    return "sha256:" + hashlib.sha256(Path(path).read_bytes()).hexdigest()[:8]


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def load_bank(path):
    """Reads the case bank and checks each case has the fields a brief prints."""
    bank = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    required = ["id", "kind", "jurisdiction", "name", "summary", "evidence",
                "outcome", "applies_when", "fit_note", "preconditions",
                "limitations", "sources"]
    seen = set()
    for case in bank["cases"]:
        missing = [k for k in required if k not in case]
        if missing:
            raise ValueError(f"case {case.get('id', '?')} is missing {missing}")
        if case["id"] in seen:
            raise ValueError(f"duplicate case id {case['id']}")
        if case["kind"] not in ("instrument", "precedent"):
            raise ValueError(f"case {case['id']} has unknown kind {case['kind']}")
        if not case["sources"]:
            raise ValueError(f"case {case['id']} has no source")
        alt = case.get("fit_note_if_assumed", {})
        for key in case["applies_when"]:
            if key in ATTRIBUTE_SWITCHES and key not in alt:
                raise ValueError(f"case {case['id']} switches on {key} but has no "
                                 f"fit_note_if_assumed.{key} for when it is unknown")
        if case.get("home_sites") and not case.get("at_home_site"):
            raise ValueError(f"case {case['id']} names home_sites but has no at_home_site wording")
        seen.add(case["id"])
    return bank


def select(scored, max_briefs):
    """Picks the sites to brief and summarises the rest.

    Sites are ranked by their highest-priority scored patch. Returns
    (chosen, not_briefed): chosen is a list of (site_id, scored rows of that
    site, highest priority first); not_briefed counts the sites and hotspots
    left out, including every unscored row.
    """
    by_site = {}
    for r in scored:
        by_site.setdefault(r["site_id"], []).append(r)
    ranked = []
    for site, rows in by_site.items():
        scored_rows = sorted((r for r in rows if r["priority"] not in ("", None)),
                             key=lambda r: -float(r["priority"]))
        if scored_rows:
            ranked.append((site, scored_rows))
    ranked.sort(key=lambda sr: (-float(sr[1][0]["priority"]), sr[0]))
    chosen = ranked[:max_briefs]
    chosen_ids = {site for site, _ in chosen}
    rest = [r for r in scored if r["site_id"] not in chosen_ids]
    rest += [r for site, _ in chosen for r in by_site[site] if r["priority"] in ("", None)]
    return chosen, {
        "count": len(rest),
        "sites": sorted({r["site_id"] for r in scored} - chosen_ids),
        "by_tier": dict(sorted(Counter(r["tier"] for r in rest).items())),
        "by_action": dict(sorted(Counter(r["action"] for r in rest).items())),
    }


def hotspot_facts(row, inputs_by_id, cfg):
    """Merges the scored row with the attributes from the scorer's input row."""
    src = inputs_by_id.get(row["hotspot_id"], {})
    facts = {k: row[k] for k in ("hotspot_id", "site_id", "run_year", "change_class",
                                 "tier", "action", "why")}
    facts["priority"] = float(row["priority"])
    facts["site_name"] = cfg.get("site_labels", {}).get(row["site_id"], row["site_id"])
    facts["driver"] = cfg["drivers"][row["change_class"]]  # checked in run()
    for name in ATTRIBUTES:
        facts[name] = (src.get(name) or "").strip()
    licence = facts["g_unlicensed"]
    facts["licence"] = "" if licence == "" else str(int(float(licence)))
    facts["g_unlicensed"] = facts["licence"]
    return facts


def eligibility(case, facts, cfg):
    """Tests the case's switches against the hotspot.

    Returns (eligible, matched, assumed, reason). A switch whose hotspot
    attribute is blank is listed under `assumed`; the case stays eligible and
    the brief says which attribute was not available.
    """
    matched, assumed = [], []
    for key, allowed in case["applies_when"].items():
        value = facts.get(key, "")
        if value == "":
            assumed.append(key)
        elif value in [str(a) for a in allowed]:
            matched.append(key)
        else:
            show = cfg["licence_labels"].get if key == "licence" else lambda v: v
            return False, [], [], (f"{SWITCH_NAMES[key]} is '{show(value)}'; the case applies to "
                                   + ", ".join(f"'{show(str(a))}'" for a in allowed))
    return True, matched, assumed, ""


def transferability(case, facts):
    """Grades how ready the case is to use at this hotspot.

    Each precondition resolves to met, partial, not_met or unknown: from the
    hotspot's own attribute where the precondition has a `check`, otherwise
    from the curator's status. One not_met gives `groundwork`; otherwise any
    partial or unknown gives `confirm`; all met gives `ready`.
    """
    conditions = []
    for pre in case["preconditions"]:
        if "check" in pre:
            value = facts.get(pre["check"]["field"], "")
            allowed = [str(a) for a in pre["check"]["in"]]
            status = "unknown" if value == "" else "met" if value in allowed else "not_met"
        else:
            status = pre["status"]
        conditions.append({"text": pre["text"], "status": status, "note": pre.get("note", "")})
    statuses = {c["status"] for c in conditions}
    grade = ("groundwork" if "not_met" in statuses
             else "confirm" if statuses & {"partial", "unknown"} else "ready")
    return grade, conditions


ATTRIBUTE_SWITCHES = ("g_protected", "licence", "v_occupancy")


def fit_text(case, assumed):
    """Why the case fits, worded for what is actually known.

    When a switch's attribute is blank for this hotspot, the case's
    fit_note_if_assumed text replaces fit_note, so the brief never states an
    unknown (e.g. "inside a known concession") as fact.
    """
    if assumed:
        alt = case.get("fit_note_if_assumed", {})
        parts = [" ".join(alt[k].split()) for k in assumed if k in alt]
        if parts:
            return " ".join(parts)
        names = " and ".join(SWITCH_NAMES[k] for k in assumed)
        return (f"This depends on the {names}, which is not yet known for this hotspot. "
                + " ".join(case["fit_note"].split()))
    return " ".join(case["fit_note"].split())


def is_home_site(case, facts):
    """True where the case is the arrangement already in place at this site."""
    homes = {str(h) for h in case.get("home_sites", [])}
    return bool(homes & {facts["site_id"], facts["site_name"]})


def origin_label(case):
    if case["jurisdiction"] != "Vietnam":
        return f"Precedent from {case['jurisdiction']}"
    return "Vietnam law in force" if case["kind"] == "instrument" else "Vietnam precedent"


def match(facts, bank, cfg):
    """Returns (options, set_aside) for one hotspot.

    Eligible cases are ordered by transferability grade, then Vietnam before
    elsewhere, then by how many switches matched. The brief takes the first
    max_instruments instruments and the first max_precedents precedents.
    """
    eligible, set_aside = [], []
    for case in bank["cases"]:
        ok, matched, assumed, reason = eligibility(case, facts, cfg)
        if not ok:
            set_aside.append({"case_id": case["id"], "name": case["name"], "reason": reason})
            continue
        home = is_home_site(case, facts)
        if home:
            grade, conditions = "in_place", []
            fits = " ".join(case["at_home_site"].split())
        else:
            grade, conditions = transferability(case, facts)
            fits = fit_text(case, assumed)
        eligible.append({
            "case_id": case["id"], "kind": case["kind"], "name": case["name"],
            "country": case["jurisdiction"], "origin": origin_label(case),
            "description": " ".join(case["summary"].split()),
            "howItFits": fits,
            "evidence": " ".join(case["evidence"].split()),
            "outcome": case["outcome"],
            "limitations": " ".join(case["limitations"].split()),
            "grade": grade, "grade_label": cfg["grades"][grade],
            "conditions": conditions,
            "matched_on": matched, "assumed": [] if home else assumed,
            "sources": case["sources"],
            "reviewed_by_svw": case.get("reviewed_by_svw", False),
        })
    eligible.sort(key=lambda o: (GRADE_ORDER.index(o["grade"]), o["country"] != "Vietnam",
                                 -len(o["matched_on"]), o["case_id"]))
    limits = {"instrument": cfg["max_instruments"], "precedent": cfg["max_precedents"]}
    options = []
    for opt in eligible:
        if limits[opt["kind"]] > 0:
            limits[opt["kind"]] -= 1
            options.append(opt)
        else:
            set_aside.append({"case_id": opt["case_id"], "name": opt["name"],
                              "reason": f"eligible; the brief carries at most {cfg['max_' + opt['kind'] + 's']} {opt['kind']}s"})
    options.sort(key=lambda o: (GRADE_ORDER.index(o["grade"]), o["kind"] != "instrument",
                                o["country"] != "Vietnam", o["case_id"]))
    return options, set_aside


def context_lines(facts, cfg):
    """Plain-language lines describing a group's shared attributes."""
    lines = [f"Loss driver: {cfg['driver_labels'][facts['driver']]}"]
    if facts["g_protected"]:
        place = cfg["protected_labels"][facts["g_protected"]]
        if facts["g_designation"] not in ("", "none"):
            place += f" ({facts['g_designation']})"
        lines.append(f"Protection status: {place}")
    if facts["licence"]:
        lines.append(f"Licence status: {cfg['licence_labels'][facts['licence']]}")
    if facts["v_occupancy"]:
        lines.append(f"Langur evidence: {cfg['occupancy_labels'][facts['v_occupancy']]}")
    return lines


STATUS_MARK = {"met": "met", "partial": "partly met", "not_met": "not met", "unknown": "to confirm"}


def group_heading(facts, cfg):
    return (cfg["protected_labels"][facts["g_protected"]].capitalize()
            if facts["g_protected"] else "Protection status not known")


def render_markdown(brief, not_briefed, provenance, cfg):
    kind = cfg["brief_types"][brief["action"]]
    tiers = ", ".join(f"{n} {t}" for t, n in brief["patches"]["by_tier"].items())
    out = [f"# {kind['title']}: {brief['site_name']}", "",
           f"Run year {brief['run_year']} | top priority {brief['top_priority']} ({brief['top_tier']}) "
           f"| {brief['patches']['count']} flagged patches ({tiers}) | triage action: {brief['action']}",
           "", f"> {' '.join(cfg['caveat'].split())}", "",
           " ".join(kind["lead"].split()), ""]
    if brief.get("narrative"):
        out += ["## Summary", "", brief["narrative"], ""]

    out += ["## What was flagged", ""]
    area = brief["patches"].get("area_ha")
    changes = ", ".join(f"{cfg['change_labels'].get(c, c)} ({n})"
                        for c, n in brief["patches"]["by_change"].items())
    out.append(f"{brief['patches']['count']} suspected forest-loss patches at this site"
               + (f", {area} ha in total" if area is not None else "") + f": {changes}.")
    out += ["", f"Highest-ranked patches (of {brief['patches']['count']}):", "",
            "| Patch | Priority | Tier | Action | Protection | Why it ranks here |",
            "| --- | --- | --- | --- | --- | --- |"]
    for t in brief["top_patches"]:
        out.append(f"| {t['hotspot_id']} | {t['priority']} | {t['tier']} | {t['action']} "
                   f"| {t['protection']} | {t['why']} |")
    out += ["", "The full ranked list is in the scorer's `priority-areas.csv`.", ""]

    out += ["## How the options are graded", "",
            " ".join(cfg["grade_legend"].split()), ""]

    many = len(brief["groups"]) > 1
    if many:
        differ = (" and ".join(brief["group_by"]) if len(brief["group_by"]) <= 2
                  else ", ".join(brief["group_by"][:-1]) + " and " + brief["group_by"][-1])
        out += [f"Patches at this site differ in {differ}, so the options are given for each group.", ""]
    for g in brief["groups"]:
        head = (f"## Options for patches {group_heading(g['facts'], cfg).lower()} "
                f"({g['patch_count']} of {brief['patches']['count']})") if many else "## Options to raise"
        out += [head, ""] + [f"- {line}" for line in g["context"]] + [""]
        unavailable = sorted({a for o in g["options"] for a in o["assumed"]})
        if unavailable:
            out += [f"Not yet known for these patches: {', '.join(SWITCH_NAMES[a] for a in unavailable)}. "
                    "Options that depend on it are worded conditionally.", ""]
        if not g["options"]:
            out += ["No case in the bank applies to these patches. That is a gap in the bank to "
                    "fill, not a finding that nothing can be done.", ""]
        for i, o in enumerate(g["options"], 1):
            out += [f"### {i}. {o['name']} [{o['case_id']}]", "",
                    f"*{o['origin']} | {o['grade_label']}*"
                    + ("" if o["reviewed_by_svw"] else " | *not yet reviewed by SVW*"), "",
                    f"**What it is.** {o['description']}", ""]
            if o["grade"] == "in_place":
                out += [f"**Already in place here.** {o['howItFits']}", "",
                        f"**Evidence.** {o['evidence']}", ""]
            else:
                out += [f"**Why it fits here.** {o['howItFits']}", "",
                        f"**Evidence.** {o['evidence']}", "",
                        "**What has to be true for it to work here.**", ""]
                for c in o["conditions"]:
                    note = f" {c['note']}" if c["note"] else ""
                    out.append(f"- {c['text']}: **{STATUS_MARK[c['status']]}**.{note}")
                out.append("")
            out += [f"**Limits.** {o['limitations']}", "", "**Sources.**", ""]
            for src in o["sources"]:
                tail = "" if src["checked"] == "full_text" else " (search excerpt only; article text to be checked)"
                out.append(f"- [{src['title']}]({src['url']}){tail}")
            out.append("")
        if g["set_aside"]:
            out += ["**Considered and set aside for these patches:**", ""]
            out += [f"- {x['name']} [{x['case_id']}]: {x['reason']}" for x in g["set_aside"]]
            out.append("")

    rest_tiers = ", ".join(f"{n} {t}" for t, n in not_briefed["by_tier"].items()) or "none"
    out += ["## The rest of this run", "",
            f"Briefs cover the {cfg['max_briefs']} sites with the highest-priority patches. "
            f"{not_briefed['count']} hotspots at other sites, or unscored, are not briefed ({rest_tiers}).", "",
            "## Provenance", "",
            f"- Case bank {provenance['bank_version']} ({provenance['bank_hash']}), "
            f"policy config {provenance['config_version']} ({provenance['config_hash']})",
            f"- Scoring config {brief['scoring_config_hash']}, build run {brief['build_run_id']}", ""]
    return "\n".join(out)


GROUP_KEYS = ("driver", "g_protected", "g_designation", "licence", "v_occupancy")
GROUP_KEY_NAMES = {"driver": "loss driver", "g_protected": "protection status",
                   "g_designation": "protection type", "licence": "licence status",
                   "v_occupancy": "langur evidence"}


def site_brief(site_id, rows, inputs_by_id, bank, cfg):
    """One site's brief: its patches, grouped by what matching reads."""
    facts_all = [hotspot_facts(r, inputs_by_id, cfg) for r in rows]   # highest priority first
    groups = {}
    for f in facts_all:
        groups.setdefault(tuple(f[k] for k in GROUP_KEYS), []).append(f)
    out_groups = []
    for key, members in groups.items():
        top = members[0]
        options, set_aside = match(top, bank, cfg)
        out_groups.append({
            "facts": {k: top[k] for k in ("site_id", "site_name") + GROUP_KEYS},
            "patch_count": len(members),
            "hotspot_ids": [m["hotspot_id"] for m in members],
            "top_hotspot_id": top["hotspot_id"], "top_priority": top["priority"],
            "context": context_lines(top, cfg),
            "options": options, "set_aside": set_aside,
        })
    out_groups.sort(key=lambda g: -g["top_priority"])
    varying = [GROUP_KEY_NAMES[k] for i, k in enumerate(GROUP_KEYS)
               if len({key[i] for key in groups}) > 1]

    action = min((f["action"] for f in facts_all), key=lambda a: ACTION_URGENCY.index(a)
                 if a in ACTION_URGENCY else len(ACTION_URGENCY))
    areas = [inputs_by_id.get(f["hotspot_id"], {}).get("t_area_ha", "") for f in facts_all]
    area = (round(sum(float(a) for a in areas), 1)
            if areas and all(a not in ("", None) for a in areas) else None)
    top = facts_all[0]
    return {
        "site_id": site_id, "site_name": top["site_name"], "run_year": top["run_year"],
        "action": action, "brief_type": cfg["brief_types"][action]["title"],
        "top_priority": top["priority"], "top_tier": top["tier"],
        "patches": {
            "count": len(facts_all),
            "area_ha": area,
            "by_tier": dict(sorted(Counter(f["tier"] for f in facts_all).items())),
            "by_change": dict(Counter(f["change_class"] for f in facts_all).most_common()),
        },
        "top_patches": [{
            "hotspot_id": f["hotspot_id"], "priority": f["priority"], "tier": f["tier"],
            "action": f["action"], "why": f["why"],
            "protection": cfg["protected_labels"].get(f["g_protected"], "not known"),
        } for f in facts_all[:cfg["top_patches_shown"]]],
        "group_by": varying,
        "groups": out_groups,
        "scoring_config_hash": rows[0]["scoring_config_hash"], "build_run_id": rows[0]["build_run_id"],
    }


def run(path_scored, path_inputs, path_out, path_bank=HERE / "policy_cases.yaml",
        path_cfg=HERE / "policy_config.yaml", narrate=False):
    cfg = yaml.safe_load(Path(path_cfg).read_text(encoding="utf-8"))
    bank = load_bank(path_bank)
    scored = read_csv(path_scored)
    inputs_by_id = {r["hotspot_id"]: r for r in read_csv(path_inputs)} if path_inputs else {}
    unmapped = sorted({r["change_class"] for r in scored} - set(cfg["drivers"]))
    if unmapped:
        raise SystemExit(f"change class(es) {unmapped} have no driver in "
                         f"{Path(path_cfg).name}; add them under `drivers` and "
                         f"`change_labels` rather than letting them be guessed")
    chosen, not_briefed = select(scored, cfg["max_briefs"])
    provenance = {"bank_version": bank["bank_version"], "bank_hash": file_hash(path_bank),
                  "config_version": cfg["config_version"], "config_hash": file_hash(path_cfg)}

    briefs = [site_brief(site, rows, inputs_by_id, bank, cfg) for site, rows in chosen]

    if narrate:
        from narrate import add_narratives
        add_narratives(briefs)

    out_dir = Path(path_out)
    (out_dir / "briefs").mkdir(parents=True, exist_ok=True)
    for b in briefs:
        text = render_markdown(b, not_briefed, provenance, cfg)
        (out_dir / "briefs" / f"{b['site_id']}.md").write_text(text, encoding="utf-8")
    payload = {"provenance": provenance, "caveat": " ".join(cfg["caveat"].split()),
               "briefs": briefs, "not_briefed": not_briefed}
    (out_dir / "policy-briefs.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return payload


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scored", default="hotspots-scored.csv",
                    help="audit file written by score_priority.py")
    ap.add_argument("--inputs", default="hotspots-scoring-input.csv",
                    help="the scorer's input file, for the hotspot attributes")
    ap.add_argument("--out", default=str(HERE / "outputs"))
    ap.add_argument("--narrate", action="store_true",
                    help="add a model-written summary to each brief (needs LLM_BASE_URL and LLM_MODEL)")
    a = ap.parse_args()
    if not Path(a.inputs).exists():
        print(f"note: {a.inputs} not found; matching runs on change class alone", file=sys.stderr)
        a.inputs = None
    res = run(a.scored, a.inputs, a.out, narrate=a.narrate)
    print(f"{'site':<22}{'patches':>8}{'top':>7}  {'action':<9}options")
    for b in res["briefs"]:
        for i, g in enumerate(b["groups"]):
            ids = ", ".join(f"{o['case_id']} ({o['grade']})" for o in g["options"]) or "none"
            label = f"{b['site_name']}" if i == 0 else ""
            count = f"{b['patches']['count']}" if i == 0 else ""
            top = f"{b['top_priority']}" if i == 0 else ""
            act = b["action"] if i == 0 else ""
            where = f"[{g['facts']['g_protected'] or '?'}: {g['patch_count']}] " if len(b["groups"]) > 1 else ""
            print(f"{label:<22}{count:>8}{top:>7}  {act:<9}{where}{ids}")
    print(f"not briefed: {res['not_briefed']['count']} hotspots at "
          f"{len(res['not_briefed']['sites'])} other sites  ->  {a.out}")
