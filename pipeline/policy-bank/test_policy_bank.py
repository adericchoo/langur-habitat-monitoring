"""Tests for the policy bank. Run from the repo root:

    python -m pytest pipeline/policy-bank
"""
import csv, json, sys
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
    base = {"hotspot_id": "HS-T", "site_id": "Test", "run_year": "2025",
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
            assert s["checked"] in ("full_text", "search_excerpt"), case["id"]


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

def test_select_takes_the_highest_priorities_in_order():
    rows = [{"priority": p, "tier": t, "action": a} for p, t, a in
            [("41.0", "P2", "watch"), ("72.5", "P1", "act"), ("", "unscored", "insufficient_data"),
             ("55.0", "P2", "watch"), ("12.0", "P3", "log")]]
    chosen, rest = pb.select(rows, 3)
    assert [r["priority"] for r in chosen] == ["72.5", "55.0", "41.0"]
    assert rest == {"count": 2, "by_tier": {"P3": 1, "unscored": 1},
                    "by_action": {"insufficient_data": 1, "log": 1}}


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
    priorities = [b["priority"] for b in briefs]
    assert priorities == sorted(priorities, reverse=True)
    total = len(list(csv.DictReader(open(SAMPLE))))
    assert payload["not_briefed"]["count"] == total - len(briefs)
    for b in briefs:
        md = (tmp_path / "out" / "briefs" / f"{b['hotspot_id']}.md").read_text(encoding="utf-8")
        assert b["site_id"] in md and "Screening output" in md
        for o in b["options"]:
            assert f"[{o['case_id']}]" in md
            assert all(s["url"] in md for s in o["sources"])
    assert json.loads((tmp_path / "out" / "policy-briefs.json").read_text(encoding="utf-8")) == payload


def test_the_same_inputs_give_byte_identical_output(scored, tmp_path):
    pb.run(scored, SAMPLE, tmp_path / "a")
    pb.run(scored, SAMPLE, tmp_path / "b")
    for name in ["policy-briefs.json"] + [f"briefs/{p.name}" for p in (tmp_path / "a" / "briefs").iterdir()]:
        assert (tmp_path / "a" / name).read_bytes() == (tmp_path / "b" / name).read_bytes()


def test_runs_without_the_scorer_input_file(scored, tmp_path):
    payload = pb.run(scored, None, tmp_path / "out")
    assert all(b["facts"]["g_protected"] == "" for b in payload["briefs"])
    assert all(b["options"] for b in payload["briefs"])


def test_survey_gap_rows_get_the_survey_first_brief(scored, tmp_path, cfg):
    rows = list(csv.DictReader(open(scored)))
    rows[0]["action"] = "survey_gap"
    edited = tmp_path / "edited.csv"
    with open(edited, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    payload = pb.run(edited, SAMPLE, tmp_path / "out")
    first = payload["briefs"][0]
    assert first["brief_type"] == "Survey-first brief"
    md = (tmp_path / "out" / "briefs" / f"{first['hotspot_id']}.md").read_text(encoding="utf-8")
    assert "field survey" in md


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
    md = (tmp_path / "out" / "briefs" / f"{brief['hotspot_id']}.md").read_text(encoding="utf-8")
    assert md.startswith("# ") and "Tam Diep" in md.splitlines()[0]


# --- the optional model summary -------------------------------------------

@pytest.fixture()
def brief(scored, tmp_path):
    return pb.run(scored, SAMPLE, tmp_path / "out")["briefs"][0]


def test_a_grounded_summary_is_kept(brief):
    cid = brief["options"][0]["case_id"]
    text = f"Satellite screening suggests clearing at {brief['site_id']}. The most ready option is [{cid}]."
    narrate.add_narratives([brief], call=lambda prompt: text)
    assert brief["narrative"] == text


def test_a_summary_citing_an_unknown_case_is_dropped(brief):
    narrate.add_narratives([brief], call=lambda prompt: "Raise [XX-INVENTED-LAW] at the board.")
    assert "narrative" not in brief
    assert any("not in this brief" in p for p in brief["narrative_rejected"])


def test_a_summary_with_an_unsourced_number_is_dropped(brief):
    cid = brief["options"][0]["case_id"]
    narrate.add_narratives([brief], call=lambda prompt: f"[{cid}] cut forest loss by 87 percent.")
    assert "narrative" not in brief
    assert any("87" in p for p in brief["narrative_rejected"])


def test_a_summary_with_no_citation_is_dropped(brief):
    narrate.add_narratives([brief], call=lambda prompt: "The board should act on this hotspot.")
    assert brief["narrative_rejected"] == ["cites no case"]
