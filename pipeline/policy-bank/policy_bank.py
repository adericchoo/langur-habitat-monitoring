"""Policy bank: hotspots-scored.csv -> policy-briefs.json + one brief per hotspot

Takes the highest-priority hotspots from the priority scorer and, for each,
lists the policy options a manager could raise, drawn from a curated bank of
cases (policy_cases.yaml).

Three steps, all rule-based:

  select    the top hotspots by the scorer's priority, plus a count of the rest
  match     each case's eligibility switches against the hotspot's attributes,
            then a transferability grade from the case's preconditions
  brief     a Markdown brief per hotspot and one JSON file for the dashboard

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
GRADE_ORDER = ["ready", "confirm", "groundwork"]
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
        seen.add(case["id"])
    return bank


def select(scored, max_briefs):
    """Splits scored rows into the hotspots to brief and a summary of the rest.

    Rows keep the scorer's order, highest priority first. Rows the scorer left
    unscored are counted in the summary.
    """
    ranked = [r for r in scored if r["priority"] not in ("", None)]
    ranked.sort(key=lambda r: -float(r["priority"]))
    chosen, rest = ranked[:max_briefs], ranked[max_briefs:]
    rest += [r for r in scored if r["priority"] in ("", None)]
    return chosen, {
        "count": len(rest),
        "by_tier": dict(sorted(Counter(r["tier"] for r in rest).items())),
        "by_action": dict(sorted(Counter(r["action"] for r in rest).items())),
    }


def hotspot_facts(row, inputs_by_id, cfg):
    """Merges the scored row with the attributes from the scorer's input row."""
    src = inputs_by_id.get(row["hotspot_id"], {})
    facts = {k: row[k] for k in ("hotspot_id", "site_id", "run_year", "change_class",
                                 "tier", "action", "why")}
    facts["priority"] = float(row["priority"])
    facts["driver"] = cfg["drivers"].get(row["change_class"], "other")
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
        grade, conditions = transferability(case, facts)
        eligible.append({
            "case_id": case["id"], "kind": case["kind"], "name": case["name"],
            "country": case["jurisdiction"], "origin": origin_label(case),
            "description": " ".join(case["summary"].split()),
            "howItFits": " ".join(case["fit_note"].split()),
            "evidence": " ".join(case["evidence"].split()),
            "outcome": case["outcome"],
            "limitations": " ".join(case["limitations"].split()),
            "grade": grade, "grade_label": cfg["grades"][grade],
            "conditions": conditions,
            "matched_on": matched, "assumed": assumed,
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
    """Plain-language lines describing the hotspot, one per known attribute."""
    lines = [f"Change detected: {cfg['change_labels'].get(facts['change_class'], facts['change_class'])} "
             f"(driver: {cfg['driver_labels'][facts['driver']]})",
             f"Why it ranks where it does: {facts['why']}"]
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


def render_markdown(brief, not_briefed, provenance, cfg):
    f, kind = brief["facts"], cfg["brief_types"][brief["facts"]["action"]]
    out = [f"# {kind['title']}: {f['site_id']} ({f['hotspot_id']})", "",
           f"Run year {f['run_year']} | priority {f['priority']} ({f['tier']}) | triage action: {f['action']}",
           "", f"> {' '.join(cfg['caveat'].split())}", "",
           " ".join(kind["lead"].split()), ""]
    if brief.get("narrative"):
        out += ["## Summary", "", brief["narrative"], ""]
    out += ["## What was flagged", ""] + [f"- {line}" for line in brief["context"]] + [""]
    unavailable = sorted({a for o in brief["options"] for a in o["assumed"]})
    if unavailable:
        unavailable = [SWITCH_NAMES[a] for a in unavailable]
        out += [f"Attributes not available for this hotspot: {', '.join(unavailable)}. "
                "Options that depend on them are listed on the assumption they apply.", ""]
    out += ["## Options to raise", ""]
    if not brief["options"]:
        out += ["No case in the bank applies to this hotspot. That is a gap in the bank to fill, "
                "not a finding that nothing can be done.", ""]
    for i, o in enumerate(brief["options"], 1):
        out += [f"### {i}. {o['name']} [{o['case_id']}]", "",
                f"*{o['origin']} | {o['grade_label']}*"
                + ("" if o["reviewed_by_svw"] else " | *not yet reviewed by SVW*"), "",
                f"**What it is.** {o['description']}", "",
                f"**Why it fits here.** {o['howItFits']}", "",
                f"**Evidence.** {o['evidence']}", "",
                "**What has to be true for it to work here.**", ""]
        for c in o["conditions"]:
            note = f" {c['note']}" if c["note"] else ""
            out.append(f"- {c['text']}: **{STATUS_MARK[c['status']]}**.{note}")
        out += ["", f"**Limits.** {o['limitations']}", "", "**Sources.**", ""]
        for s in o["sources"]:
            tail = "" if s["checked"] == "full_text" else " (search excerpt only; article text to be checked)"
            out.append(f"- [{s['title']}]({s['url']}){tail}")
        out.append("")
    if brief["set_aside"]:
        out += ["## Considered and set aside", ""]
        out += [f"- {s['name']} [{s['case_id']}]: {s['reason']}" for s in brief["set_aside"]]
        out.append("")
    tiers = ", ".join(f"{n} {t}" for t, n in not_briefed["by_tier"].items()) or "none"
    out += ["## The rest of this run", "",
            f"{not_briefed['count']} other hotspots from this run are not briefed ({tiers}). "
            f"Briefs cover the {cfg['max_briefs']} highest-priority hotspots only.", "",
            "## Provenance", "",
            f"- Case bank {provenance['bank_version']} ({provenance['bank_hash']}), "
            f"policy config {provenance['config_version']} ({provenance['config_hash']})",
            f"- Scoring config {brief['scoring_config_hash']}, build run {brief['build_run_id']}", ""]
    return "\n".join(out)


def run(path_scored, path_inputs, path_out, path_bank=HERE / "policy_cases.yaml",
        path_cfg=HERE / "policy_config.yaml", narrate=False):
    cfg = yaml.safe_load(Path(path_cfg).read_text(encoding="utf-8"))
    bank = load_bank(path_bank)
    scored = read_csv(path_scored)
    inputs_by_id = {r["hotspot_id"]: r for r in read_csv(path_inputs)} if path_inputs else {}
    chosen, not_briefed = select(scored, cfg["max_briefs"])
    provenance = {"bank_version": bank["bank_version"], "bank_hash": file_hash(path_bank),
                  "config_version": cfg["config_version"], "config_hash": file_hash(path_cfg)}

    briefs = []
    for row in chosen:
        facts = hotspot_facts(row, inputs_by_id, cfg)
        options, set_aside = match(facts, bank, cfg)
        briefs.append({
            "hotspot_id": facts["hotspot_id"], "site_id": facts["site_id"],
            "priority": facts["priority"], "tier": facts["tier"], "action": facts["action"],
            "brief_type": cfg["brief_types"][facts["action"]]["title"],
            "facts": facts, "context": context_lines(facts, cfg),
            "options": options, "set_aside": set_aside,
            "scoring_config_hash": row["scoring_config_hash"], "build_run_id": row["build_run_id"],
        })

    if narrate:
        from narrate import add_narratives
        add_narratives(briefs)

    out_dir = Path(path_out)
    (out_dir / "briefs").mkdir(parents=True, exist_ok=True)
    for b in briefs:
        text = render_markdown(b, not_briefed, provenance, cfg)
        (out_dir / "briefs" / f"{b['hotspot_id']}.md").write_text(text, encoding="utf-8")
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
    print(f"{'hotspot':<14}{'site':<14}{'priority':>9}  {'action':<11}options")
    for b in res["briefs"]:
        ids = ", ".join(f"{o['case_id']} ({o['grade']})" for o in b["options"]) or "none"
        print(f"{b['hotspot_id']:<14}{b['site_id']:<14}{b['priority']:>9}  {b['action']:<11}{ids}")
    print(f"not briefed: {res['not_briefed']['count']}  ->  {a.out}")
