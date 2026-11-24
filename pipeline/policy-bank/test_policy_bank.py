"""Tests for the policy bank. Run from the repo root:

    python -m pytest pipeline/policy-bank
"""
import csv, copy, json, re, sys
from pathlib import Path

import pytest
import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "priority-scoring"))

import narrate
import policy_bank as pb
from score_priority import score

SAMPLE = HERE / "sample" / "hotspots-scoring-input.csv"
SCORER_CFG = HERE.parent / "priority-scoring" / "priority_config.yaml"


@pytest.fixture(scope="module")
def cfg():
    return yaml.safe_load((HERE / "policy_config.yaml").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def bank():
    return pb.load_bank(HERE / "policy_cases.yaml")


@pytest.fixture()
def scored(tmp_path):
    """Runs the real scorer on the sample input and returns the audit file path."""
    audit = tmp_path / "hotspots-scored.csv"
    score(str(SAMPLE), str(tmp_path / "priority-areas.csv"), str(SCORER_CFG), str(audit))
    return audit


def facts(**over):
    base = {"hotspot_id": "HS-T", "site_id": "Test", "site_name": "Test", "run_year": "2025",
            "change_class": "forest_to_quarry", "driver": "mining", "tier": "P1",
            "action": "act", "why": "area cleared (0.90)", "priority": 70.0,
            "g_protected": "inside", "g_designation": "Nature Reserve",
            "g_unlicensed": "1", "licence": "1", "v_occupancy": "confirmed"}
    return base | over


# --- the bank -------------------------------------------------------------

def test_every_case_has_a_source_with_a_url(bank):
    for case in bank["cases"]:
        for s in case["sources"]:
            assert s["url"].startswith("https://"), case["id"]
            assert s["checked"] in pb.CHECKED, case["id"]


def test_every_source_was_read_and_carries_a_short_quote_and_a_locator(bank):
    for case in bank["cases"]:
        for n, s in enumerate(case["sources"], 1):
            where = f"{case['id']} source {n}"
            assert s["checked"] in ("full_text", "passage"), where   # nothing rests on a search excerpt
            assert s["locator"].strip(), where
            assert 0 < len(s["quote"].split()) < 15, where


def test_every_citation_resolves_and_every_source_is_cited(bank):
    for case in bank["cases"]:
        assert re.search(r"\[\d+\]", case["evidence"]), case["id"]
        cited = {int(m) for m in re.findall(r"\[(\d+)\]", pb.cited_text(case))}
        assert cited == set(range(1, len(case["sources"]) + 1)), case["id"]


def test_an_instrument_leads_with_the_policy_text_itself(bank):
    """The overview links an option's name to its first source, so for a law
    that source is the law, quoted at an article."""
    for case in bank["cases"]:
        if case["kind"] == "instrument":
            assert "Article" in case["sources"][0]["locator"], case["id"]


def _bank_with(tmp_path, bank, **edits):
    case = copy.deepcopy(bank["cases"][0])
    for key, value in edits.items():
        case[key] = value
    p = tmp_path / "bank.yaml"
    p.write_text(yaml.safe_dump({"bank_version": "x", "cases": [case]}), encoding="utf-8")
    return p, case


def test_load_bank_rejects_a_quoted_search_excerpt(tmp_path, bank):
    sources = copy.deepcopy(bank["cases"][0]["sources"])
    sources[0]["checked"] = "search_excerpt"
    p, _ = _bank_with(tmp_path, bank, sources=sources)
    with pytest.raises(ValueError, match="search excerpt"):
        pb.load_bank(p)


def test_load_bank_rejects_an_overlong_quote(tmp_path, bank):
    sources = copy.deepcopy(bank["cases"][0]["sources"])
    sources[0]["quote"] = " ".join(["word"] * 15)
    p, _ = _bank_with(tmp_path, bank, sources=sources)
    with pytest.raises(ValueError, match="over"):
        pb.load_bank(p)


def test_load_bank_rejects_a_citation_to_a_missing_source(tmp_path, bank):
    p, case = _bank_with(tmp_path, bank)
    case["evidence"] += " A further claim [9]."
    p.write_text(yaml.safe_dump({"bank_version": "x", "cases": [case]}), encoding="utf-8")
    with pytest.raises(ValueError, match=r"\[9\]"):
        pb.load_bank(p)


def test_load_bank_rejects_a_source_nobody_cites(tmp_path, bank):
    sources = copy.deepcopy(bank["cases"][0]["sources"])
    sources.append(dict(sources[0], title="Unused"))
    p, _ = _bank_with(tmp_path, bank, sources=sources)
    with pytest.raises(ValueError, match="never cites"):
        pb.load_bank(p)


def test_load_bank_rejects_evidence_without_a_citation(tmp_path, bank):
    p, _ = _bank_with(tmp_path, bank, evidence="An unsourced claim.")
    with pytest.raises(ValueError, match="cites no source"):
        pb.load_bank(p)


def test_applies_when_uses_known_keys_and_values(bank, cfg):
    allowed = {"driver": set(cfg["drivers"].values()),
               "g_protected": set(cfg["protected_labels"]),
               "licence": set(cfg["licence_labels"]),
               "v_occupancy": set(cfg["occupancy_labels"])}
    for case in bank["cases"]:
        for key, values in case["applies_when"].items():
            assert key in allowed, f"{case['id']}: {key}"
            assert set(map(str, values)) <= allowed[key], f"{case['id']}: {key}"


def test_preconditions_have_a_check_or_a_status(bank):
    for case in bank["cases"]:
        for pre in case["preconditions"]:
            assert ("check" in pre) != ("status" in pre), case["id"]
            if "status" in pre:
                assert pre["status"] in ("met", "partial", "not_met", "unknown")
            else:
                assert pre["check"]["field"] in pb.ATTRIBUTES


def test_load_bank_rejects_a_case_without_sources(tmp_path, bank):
    broken = {"bank_version": "x", "cases": [dict(bank["cases"][0], sources=[])]}
    p = tmp_path / "bank.yaml"
    p.write_text(yaml.safe_dump(broken), encoding="utf-8")
    with pytest.raises(ValueError):
        pb.load_bank(p)


# --- select ---------------------------------------------------------------

def test_select_ranks_sites_by_their_highest_priority_patch():
    rows = [{"site_id": s, "priority": p, "tier": t, "action": a} for s, p, t, a in
            [("A", "41.0", "P2", "watch"), ("B", "72.5", "P1", "act"), ("C", "", "unscored", "insufficient_data"),
             ("A", "55.0", "P2", "watch"), ("D", "12.0", "P3", "log"), ("B", "", "unscored", "insufficient_data")]]
    chosen, rest = pb.select(rows, 2)
    assert [site for site, _ in chosen] == ["B", "A"]
    assert [r["priority"] for r in chosen[1][1]] == ["55.0", "41.0"]   # a site's patches, best first
    # D and C are not briefed; B's unscored row is counted, not briefed
    assert rest == {"count": 3, "sites": ["C", "D"], "by_tier": {"P3": 1, "unscored": 2},
                    "by_action": {"insufficient_data": 2, "log": 1}}


# --- match ----------------------------------------------------------------

def test_a_case_for_another_driver_is_set_aside_with_a_reason(bank, cfg):
    options, set_aside = pb.match(facts(), bank, cfg)
    reasons = {s["case_id"]: s["reason"] for s in set_aside}
    assert "VN-PFES" in reasons and "loss driver is 'mining'" in reasons["VN-PFES"]
    assert "VN-PFES" not in [o["case_id"] for o in options]


def test_mining_inside_a_protected_area_leads_with_the_minerals_law(bank, cfg):
    options, _ = pb.match(facts(), bank, cfg)
    ids = [o["case_id"] for o in options]
    assert "VN-MINERALS-2024" in ids and "VN-FORESTRY-2017" in ids
    assert "IN-MINING-BUFFER-2023" not in ids


def test_mining_outside_protection_gets_the_designation_precedent(bank, cfg):
    options, set_aside = pb.match(facts(g_protected="outside", g_designation="none"), bank, cfg)
    ids = [o["case_id"] for o in options]
    assert "VN-KIMBANG-DESIGNATION" in ids
    assert "VN-MINERALS-2024" in [s["case_id"] for s in set_aside]


def test_a_case_matching_more_of_the_patch_is_listed_first(bank, cfg):
    """Quarrying inside a reserve: the mining ban (matches driver and protection)
    comes before the forestry rule (matches protection only), so the overview,
    which shows the first options, names the ban."""
    options, _ = pb.match(facts(g_protected="inside", licence="", g_unlicensed=""), bank, cfg)
    ids = [o["case_id"] for o in options]
    assert ids.index("VN-MINERALS-2024") < ids.index("VN-FORESTRY-2017")


def test_a_failed_check_grades_the_option_as_groundwork(bank, cfg):
    options, _ = pb.match(facts(g_protected="outside", g_designation="none"), bank, cfg)
    india = next(o for o in options if o["case_id"] == "IN-MINING-BUFFER-2023")
    assert india["grade"] == "groundwork"
    assert any(c["status"] == "not_met" for c in india["conditions"])


def test_options_are_ordered_best_grade_first(bank, cfg):
    for f in (facts(), facts(g_protected="buffer"), facts(g_protected="outside"),
              facts(change_class="forest_to_agriculture", driver="farming", licence="", g_unlicensed="")):
        grades = [pb.GRADE_ORDER.index(o["grade"]) for o in pb.match(f, bank, cfg)[0]]
        assert grades == sorted(grades)


def test_a_blank_attribute_keeps_the_case_and_says_what_was_assumed(bank, cfg):
    options, _ = pb.match(facts(g_protected="", licence="", g_unlicensed="", v_occupancy=""), bank, cfg)
    law = next(o for o in options if o["case_id"] == "VN-MINERALS-2024")
    assert law["assumed"] == ["g_protected"]
    assert law["grade"] == "confirm"


def test_every_attribute_switch_has_wording_for_when_it_is_unknown(bank):
    for case in bank["cases"]:
        for key in case["applies_when"]:
            if key in pb.ATTRIBUTE_SWITCHES:
                assert key in case.get("fit_note_if_assumed", {}), case["id"]


def test_load_bank_rejects_an_attribute_switch_without_unknown_wording(tmp_path, bank):
    broken = yaml.safe_load(yaml.safe_dump(bank))
    case = next(c for c in broken["cases"] if c["id"] == "VN-REMEDIATION-DEPOSIT")
    del case["fit_note_if_assumed"]
    path = tmp_path / "cases.yaml"
    path.write_text(yaml.safe_dump(broken), encoding="utf-8")
    with pytest.raises(ValueError, match="fit_note_if_assumed"):
        pb.load_bank(path)


def test_an_unknown_licence_is_never_stated_as_fact(bank, cfg):
    options, _ = pb.match(facts(g_protected="outside", licence="", g_unlicensed=""), bank, cfg)
    deposit = next(o for o in options if o["case_id"] == "VN-REMEDIATION-DEPOSIT")
    assert deposit["assumed"] == ["licence"]
    assert "not yet known" in deposit["howItFits"]
    assert "inside a known concession" not in deposit["howItFits"]


def test_a_known_licence_keeps_the_plain_fit_note(bank, cfg):
    options, _ = pb.match(facts(g_protected="outside", licence="0", g_unlicensed="0"), bank, cfg)
    deposit = next(o for o in options if o["case_id"] == "VN-REMEDIATION-DEPOSIT")
    assert deposit["assumed"] == []
    assert "inside a known concession" in deposit["howItFits"]


def test_a_case_at_its_home_site_is_graded_in_place(bank, cfg):
    options, _ = pb.match(facts(site_id="van-long-dong-tam", site_name="Van Long - Dong Tam",
                                g_protected="inside"), bank, cfg)
    vl = next(o for o in options if o["case_id"] == "VN-VANLONG-COMMUNITY")
    assert vl["grade"] == "in_place" and vl["conditions"] == []
    assert "already running at Van Long" in vl["howItFits"]
    assert options[0]["case_id"] == "VN-VANLONG-COMMUNITY"   # in place sorts first


def test_the_same_case_elsewhere_is_a_precedent_to_raise(bank, cfg):
    options, _ = pb.match(facts(site_id="hoa-lu-trang-an", site_name="Hoa Lu / Trang An",
                                g_protected="inside"), bank, cfg)
    vl = next(o for o in options if o["case_id"] == "VN-VANLONG-COMMUNITY")
    assert vl["grade"] != "in_place" and vl["conditions"]


def test_kim_bang_designation_at_kim_bang_asks_for_a_boundary_check(bank, cfg):
    options, _ = pb.match(facts(site_id="kim-bang", site_name="Kim Bang", g_protected="outside",
                                licence="", g_unlicensed=""), bank, cfg)
    kb = next(o for o in options if o["case_id"] == "VN-KIMBANG-DESIGNATION")
    assert kb["grade"] == "in_place" and "new boundary" in kb["howItFits"]


def test_load_bank_rejects_home_sites_without_home_wording(tmp_path, bank):
    broken = yaml.safe_load(yaml.safe_dump(bank))
    case = next(c for c in broken["cases"] if c["id"] == "VN-VANLONG-COMMUNITY")
    del case["at_home_site"]
    path = tmp_path / "cases.yaml"
    path.write_text(yaml.safe_dump(broken), encoding="utf-8")
    with pytest.raises(ValueError, match="at_home_site"):
        pb.load_bank(path)


def test_bare_rock_extraction_is_briefed_as_quarrying(cfg):
    assert cfg["drivers"]["bare_rock_extraction"] == "mining"
    line = pb.context_lines(facts(change_class="bare_rock_extraction", driver="mining"), cfg)[0]
    assert "quarrying" in line and "built-up" not in line


def test_a_brief_carries_at_most_the_configured_number_of_each_kind(bank, cfg):
    options, _ = pb.match(facts(g_protected="buffer", licence="0", g_unlicensed="0"), bank, cfg)
    kinds = [o["kind"] for o in options]
    assert kinds.count("instrument") <= cfg["max_instruments"]
    assert kinds.count("precedent") <= cfg["max_precedents"]


# --- end to end, from the real scorer's output ------------------------------

def test_end_to_end_from_the_scorer(scored, tmp_path, cfg):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    briefs = payload["briefs"]
    assert len(briefs) == cfg["max_briefs"]
    tops = [b["top_priority"] for b in briefs]
    assert tops == sorted(tops, reverse=True)
    total = len(list(csv.DictReader(open(SAMPLE))))
    briefed = sum(b["patches"]["count"] for b in briefs)
    assert payload["not_briefed"]["count"] == total - briefed
    for b in briefs:
        md = (tmp_path / "out" / "briefs" / f"{b['site_id']}.md").read_text(encoding="utf-8")
        assert b["site_name"] in md.splitlines()[0] and "Screening output" in md
        assert "## How the options are graded" in md
        assert sum(g["patch_count"] for g in b["groups"]) == b["patches"]["count"]
        for g in b["groups"]:
            for o in g["options"]:
                assert f"[{o['case_id']}]" in md
                assert all(s["url"] in md for s in o["sources"])
                assert all(f"\u201c{s['quote']}\u201d" in md for s in o["sources"])
    assert json.loads((tmp_path / "out" / "policy-briefs.json").read_text(encoding="utf-8")) == payload


def test_the_same_inputs_give_byte_identical_output(scored, tmp_path):
    pb.run(scored, SAMPLE, tmp_path / "a")
    pb.run(scored, SAMPLE, tmp_path / "b")
    for name in ["policy-briefs.json"] + [f"briefs/{p.name}" for p in (tmp_path / "a" / "briefs").iterdir()]:
        assert (tmp_path / "a" / name).read_bytes() == (tmp_path / "b" / name).read_bytes()


def test_runs_without_the_scorer_input_file(scored, tmp_path):
    payload = pb.run(scored, None, tmp_path / "out")
    groups = [g for b in payload["briefs"] for g in b["groups"]]
    assert all(g["facts"]["g_protected"] == "" for g in groups)
    assert all(g["options"] for g in groups)


def test_a_site_whose_most_urgent_patch_is_survey_gap_gets_the_survey_first_brief(scored, tmp_path):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    tam = next(b for b in payload["briefs"] if b["site_name"] == "Tam Diep")   # one survey_gap patch
    assert tam["action"] == "survey_gap" and tam["brief_type"] == "Survey-first brief"
    md = (tmp_path / "out" / "briefs" / f"{tam['site_id']}.md").read_text(encoding="utf-8")
    assert "field survey" in md


def test_a_site_brief_takes_its_most_urgent_action(scored, tmp_path):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    kim = next(b for b in payload["briefs"] if b["site_name"] == "Kim Bang")   # one act, one watch
    assert kim["action"] == "act" and kim["brief_type"] == "Escalation brief"


def test_patches_that_match_differently_are_grouped_with_their_own_options(scored, tmp_path):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    kim = next(b for b in payload["briefs"] if b["site_name"] == "Kim Bang")   # outside + buffer
    assert sorted(g["facts"]["g_protected"] for g in kim["groups"]) == ["buffer", "outside"]
    assert kim["group_by"] == ["protection status"]
    md = (tmp_path / "out" / "briefs" / f"{kim['site_id']}.md").read_text(encoding="utf-8")
    assert "## Options for patches outside any protected area (1 of 2)" in md
    assert "## Options for patches in a protected-area buffer zone (1 of 2)" in md


# --- the plain-English overview ---------------------------------------------

def test_the_overview_is_plain_english_with_links_and_no_ids(scored, tmp_path, bank):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    text = (tmp_path / "out" / "overview.md").read_text(encoding="utf-8")
    assert not any(c["id"] in text for c in bank["cases"])
    assert not re.search(r"\bHS-\d", text)                 # no hotspot ids either
    assert not re.search(r"\[\d+\]", text)                # citation markers stay in the briefs
    main_sources = {c["sources"][0]["url"] for c in bank["cases"]}
    linked = set(re.findall(r"\]\((https://[^)]+)\)", text))
    assert linked and linked <= main_sources                # each link is a case's main source
    for b in payload["briefs"]:
        assert b["site_name"] in text
        assert b["overview"] == payload["overview"]["sites"][b["site_id"]]


def test_the_overview_is_conditional_when_protection_is_unknown(scored, tmp_path):
    payload = pb.run(scored, None, tmp_path / "out")        # no protection status at all
    for b in payload["briefs"]:
        assert "is already in place" in b["overview"] or "confirm that" in b["overview"]
        assert "every condition for it holds" not in b["overview"]


def test_the_overview_says_the_same_thing_twice(scored, tmp_path):
    pb.run(scored, SAMPLE, tmp_path / "a")
    pb.run(scored, SAMPLE, tmp_path / "b")
    assert (tmp_path / "a" / "overview.md").read_bytes() == (tmp_path / "b" / "overview.md").read_bytes()


# --- the compact dashboard file ---------------------------------------------

def test_the_dashboard_file_is_a_compact_copy_of_the_briefs(scored, tmp_path, bank, cfg):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    dash = json.loads((tmp_path / "out" / "policy-dashboard.json").read_text(encoding="utf-8"))
    assert dash["schema"] == "policy-dashboard/v1"
    assert [s["site_id"] for s in dash["sites"]] == [b["site_id"] for b in payload["briefs"]]
    sources = {c["id"]: c["sources"][0] for c in bank["cases"]}
    for site, brief in zip(dash["sites"], payload["briefs"]):
        assert site["patches"]["count"] == brief["patches"]["count"]
        assert site["options"] and len({o["id"] for o in site["options"]}) == len(site["options"])
        matched = {(o["case_id"], o["grade"]) for g in brief["groups"] for o in g["options"]}
        for o in site["options"]:
            assert (o["case_id"], o["grade"]) in matched       # nothing the briefs don't say
            assert o["case_id"] not in o["name"] + o["does"] + o["next_step"]
            assert o["next_step"]
            assert o["source"]["url"] == sources[o["case_id"]]["url"]
            assert o["source"]["quote"] == sources[o["case_id"]]["quote"]
            assert 0 < o["patch_count"] <= site["patches"]["count"]
        assert "**" not in site["summary"] and "](" not in site["summary"]
        assert site["driver"] in set(cfg["drivers"].values())
        for o in site["options"]:
            for field in ("title", "description", "how_it_fits", "limitations"):
                assert o[field] and not re.search(r"\[\d+\]", o[field]), (o["id"], field)
                assert not re.search(r"\b[Aa] area\b", o[field]), (o["id"], field)


def test_the_dashboard_lists_every_scored_site(scored, tmp_path):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    dash = json.loads((tmp_path / "out" / "policy-dashboard.json").read_text(encoding="utf-8"))
    rows = list(csv.DictReader(open(scored)))
    assert {s["site_id"] for s in dash["all_sites"]} == {r["site_id"] for r in rows}
    assert sum(s["patches"] for s in dash["all_sites"]) == len(rows)
    assert {s["site_id"] for s in dash["all_sites"] if s["briefed"]} == {b["site_id"] for b in payload["briefs"]}


def test_an_option_shared_by_two_groups_is_listed_once(scored, tmp_path):
    payload = pb.run(scored, SAMPLE, tmp_path / "out")
    dash = json.loads((tmp_path / "out" / "policy-dashboard.json").read_text(encoding="utf-8"))
    kim = next(s for s in dash["sites"] if s["site_name"] == "Kim Bang")   # outside + buffer
    brief = next(b for b in payload["briefs"] if b["site_name"] == "Kim Bang")
    per = brief["groups"][0]["options"][0]
    shared = [o for o in kim["options"] if o["case_id"] == per["case_id"] and o["grade"] == per["grade"]]
    assert len(shared) == 1


def _edit_first_row(scored, tmp_path, **changes):
    rows = list(csv.DictReader(open(scored)))
    rows[0].update(changes)
    edited = tmp_path / "edited.csv"
    with open(edited, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return edited


def test_an_unmapped_change_class_stops_the_run(scored, tmp_path):
    edited = _edit_first_row(scored, tmp_path, change_class="forest_to_something_new")
    with pytest.raises(SystemExit, match="forest_to_something_new"):
        pb.run(edited, SAMPLE, tmp_path / "out")


def test_site_slugs_from_the_build_step_are_shown_by_name(scored, tmp_path):
    edited = _edit_first_row(scored, tmp_path, site_id="tam-diep-forest-nb")
    payload = pb.run(edited, SAMPLE, tmp_path / "out")
    brief = next(b for b in payload["briefs"] if b["site_id"] == "tam-diep-forest-nb")
    assert brief["site_name"] == "Tam Diep"
    md = (tmp_path / "out" / "briefs" / f"{brief['site_id']}.md").read_text(encoding="utf-8")
    assert md.startswith("# ") and "Tam Diep" in md.splitlines()[0]


# --- the optional model summary -------------------------------------------

@pytest.fixture()
def brief(scored, tmp_path):
    return pb.run(scored, SAMPLE, tmp_path / "out")["briefs"][0]


def test_a_grounded_summary_is_kept(brief):
    cid = narrate.all_options(brief)[0]["case_id"]
    text = f"Satellite screening suggests clearing at {brief['site_id']}. The most ready option is [{cid}]."
    narrate.add_narratives([brief], call=lambda prompt: text)
    assert brief["narrative"] == text


def test_a_summary_citing_an_unknown_case_is_dropped(brief):
    narrate.add_narratives([brief], call=lambda prompt: "Raise [XX-INVENTED-LAW] at the board.")
    assert "narrative" not in brief
    assert any("not in this brief" in p for p in brief["narrative_rejected"])


def test_a_summary_with_an_unsourced_number_is_dropped(brief):
    cid = narrate.all_options(brief)[0]["case_id"]
    narrate.add_narratives([brief], call=lambda prompt: f"[{cid}] cut forest loss by 87 percent.")
    assert "narrative" not in brief
    assert any("87" in p for p in brief["narrative_rejected"])


def test_a_summary_with_no_citation_is_dropped(brief):
    narrate.add_narratives([brief], call=lambda prompt: "The board should act on this hotspot.")
    assert brief["narrative_rejected"] == ["cites no case"]
