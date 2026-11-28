# Policy bank

Takes the sites with the highest-priority hotspots from the priority scorer and,
for each site, lists the policy options a manager could raise at a board meeting. Options come
from a hand-curated bank of cases, each with its sources.

**Screening, not advice.** Each hotspot is a *suspected* land-cover change from
satellite classification, and the options are matched by fixed rules. Save
Vietnam's Wildlife reviews every brief before it is used.

```
priority-scoring                     policy-bank
hotspots-scoring-input.csv ──┐
        │                    ├──▶ select ─▶ match ─▶ brief ─▶ outputs/briefs/<site>.md   
        ▼                    │                               outputs/policy-briefs.json
hotspots-scored.csv ─────────┘
```

## Inputs

| Input | Default path | Notes |
| --- | --- | --- |
| Scored hotspots | `hotspots-scored.csv` | the audit file `score_priority.py` writes; carries `priority`, `tier`, `action`, `why` |
| Scorer input | `hotspots-scoring-input.csv` | the same file the scorer read; supplies `g_protected`, `g_designation`, `g_unlicensed`, `v_occupancy`, joined on `hotspot_id` |

The policy bank reads both files as the scorer already produces and consumes
them. Neither file's columns change. Without the scorer input, matching runs on
the change class alone and each brief says which attributes were not available.

Both files come from the priority-scoring step. On real data, run
`pipeline/priority-scoring/build_hotspots.py` first (see that folder's README),
then the scorer, then this step. Every `change_class` in the scored file must
have an entry under `drivers` in `policy_config.yaml`; the run stops and names
any that don't, so a new change class is never guessed into the wrong driver.
Site ids from the build step (e.g. `tam-diep-forest-nb`) are shown in briefs by
the display names under `site_labels`.

## Method

**1. Select.** One brief per site, for the `max_briefs` (3) sites whose
highest-priority patch ranks highest. Everything else is counted by tier and
action, and every brief states that count, so three briefs are never read as
the whole picture.

Briefs are per site because the options act on a site or a province (a
designation, a licence check, a provincial decision), and the real data has
many patches per site: 27 to 42 at the top three sites in the 2017 -> 2025 run.
One brief per patch repeated the same options for every patch.

Within a site, patches are grouped by the attributes matching reads (loss
driver, protection status and type, licence status, langur evidence). Every
patch in a group gets the same options by construction, so each group is
matched once and the brief gives options per group. A site where all patches
share those attributes has one group; Van Long - Dong Tam, with patches inside
the reserve, in its buffer zone and outside it, has three. A site's brief takes
its most urgent action (`act`, then `survey_gap`, then `watch`, then `log`) and
lists its top `top_patches_shown` (5) patches by name.

**2. Match.** Each case in `policy_cases.yaml` carries eligibility switches
(`applies_when`): the loss driver, protection status, licence status and langur
evidence it applies to. A case whose switch does not match the hotspot is set
aside and the brief says why. Matching is by rule because the bank is small and
curated: every option in a brief can be traced to the attribute that put it
there.

A case can name its **home sites** (`home_sites`): the places where it is the
arrangement already in place, such as the Van Long community model at Van Long
or the Kim Bang designation at Kim Bang. Offered there as a precedent to adopt,
it would be wrong. At a home site the case is graded **already in place here**,
listed first, and worded as a check on whether it is working
(`at_home_site`).

**3. Grade transferability.** A measure that worked somewhere else may not work
at this hotspot. Each case lists the preconditions it depends on. A
precondition is either checked against the hotspot's own attributes (is the
patch inside a protected area? is the quarry licensed?) or carries the
curator's reading for Vietnam (`met`, `partial`, `not_met`, `unknown`), with a
note. The grade follows from them:

| Grade | Rule |
| --- | --- |
| already in place here | the case is in force at this site (home site); the question is whether it is working |
| ready to raise | every precondition met |
| conditions to confirm first | at least one partly met or unknown, none failed |
| needs groundwork first | at least one not met |

Options are listed best grade first, Vietnamese law before precedent, Vietnam
before elsewhere. A brief carries at most `max_instruments` (2) laws in force
and `max_precedents` (2) precedents.

**4. Brief.** Every brief prints a one-paragraph legend of the grades, so a
reader without this README knows what they mean. The site's triage action
sets the framing: `act` gives an escalation brief, `watch` a monitoring brief, `survey_gap` a survey-first brief
that leads with confirming occupancy, `log` a for-the-record brief. Each option
shows what it is, why it fits, the evidence, the preconditions with their
status, its limits and its numbered sources. Claims in the evidence carry
markers such as [1], and each source is listed with a short verbatim quote and
where in the source it sits (article and clause for a law), so a reader can
check a claim against the text.

**5. Plain-English overview.** Each brief opens with an "In brief" paragraph,
and `outputs/overview.md` collects one paragraph per briefed site under a
run-level opening. The text is built from templates (`overview.py`), not by a
model: every clause comes from a field the run already holds (the scorer's
counts and tiers, each case's curated `plain_name` and `plain_use`, the grade,
and the status of each precondition). The wording follows the grade: "is
already in place here, so ...", "can be raised now", "before raising it,
confirm that ...", or "needs groundwork first". Where an attribute such as
licence status is unknown, the sentence names the condition to confirm rather
than stating it. Each option's name links to the case's main source, which for
a law is the law itself. Case ids and hotspot ids stay in the briefs and the
JSON; the overview carries none.

Templates were chosen over a language model for this step because the
overview is the part most people will read, and a template cannot state a fact
the run does not hold. The optional model summary below is kept separate and
checked.

Steps 1 to 5 are plain code with no model in the loop, so the same inputs give
byte-identical briefs and overview.

**6. Optional summary (`--narrate`).** A language model can add one summary
paragraph per brief. It is shown only that brief's matched options and its
output is checked: every case it cites must be one of the brief's options,
every number must appear in the material it was shown, and it must cite at
least one case. A summary that fails is dropped and the reason is recorded in
`policy-briefs.json`. Any endpoint that speaks the chat-completions format
works, including a local model server:

```bash
export LLM_BASE_URL=http://localhost:11434/v1   # PowerShell: $env:LLM_BASE_URL = "..."
export LLM_MODEL=<model name>
export LLM_API_KEY=<only if the endpoint needs one>
```

Keep keys in the environment or an untracked `.env`; never commit them.

## Run

```bash
python -m venv .venv && .venv/Scripts/activate   # Windows; use source .venv/bin/activate elsewhere
pip install -r pipeline/policy-bank/requirements.txt

# 1. score the sample hotspots (writes the scorer's outputs into outputs/)
mkdir pipeline/policy-bank/outputs
python pipeline/priority-scoring/score_priority.py pipeline/policy-bank/sample/hotspots-scoring-input.csv pipeline/policy-bank/outputs/priority-areas.csv pipeline/priority-scoring/priority_config.yaml pipeline/policy-bank/outputs/hotspots-scored.csv

# 2. run the policy bank on the scorer's output
python pipeline/policy-bank/policy_bank.py --scored pipeline/policy-bank/outputs/hotspots-scored.csv --inputs pipeline/policy-bank/sample/hotspots-scoring-input.csv

# tests
python -m pytest pipeline/policy-bank
```

Output goes to `pipeline/policy-bank/outputs/` (gitignored until
reviewed):

- `overview.md`: the plain-English overview, with links to each option's main
  source. The terminal prints the same text without links; `--ids` prints the
  hotspot and case id table instead.
- `briefs/<site_id>.md`: one brief per selected site.
- `policy-dashboard.json`: a compact copy for the dashboard's Policy step
  (`dashboard.py`, schema `policy-dashboard/v1`). Per briefed site it holds the
  headline numbers and the same few options the overview names, each with its
  grade, one next step, the patches it covers, its main source with the
  quote, and the card fields the Policy step shows (`title`, `description`,
  `how_it_fits`, `limitations`, with citation markers removed), plus `all_sites` with every scored site's patch count and best tier,
  so the dashboard can say something for a site that was not briefed. It
  writes no new text: every string is copied from the briefs. The
  dashboard reads a committed copy at `web/src/results/policy-dashboard-2025.json`;
  to update it, copy a new run's file over that one.
- `policy-briefs.json`: the same content for the dashboard. Each option carries
  `name`, `country`, `description`, `howItFits`, `limitations` and `sources`,
  the fields the policy step's sample bank (`web/src/samples/policyBank.ts`)
  already uses, plus the grade and preconditions. Each source carries
  `locator`, `quote` and `checked`. The run's overview text is under
  `overview`, keyed by site.

`sample/hotspots-scoring-input.csv` is **synthetic**: eight invented hotspots
on publicly-known site names, shaped like the scorer's input, with no
coordinates. Its numbers are not findings. To brief the real run instead, point
`--scored` and `--inputs` at the files in `pipeline/priority-scoring/outputs/`.

## The case bank

`policy_cases.yaml` holds 8 cases: four Vietnamese laws or programmes in force,
two Vietnamese precedents (Van Long, Kim Bang) and two from elsewhere (Guangxi,
India). The design target is 30 to 50.

To add a case, copy an entry and fill every field. The tests check that each
case has a source, that its switches use known values, that each precondition
has either a `check` or a `status`, and that the sources and citations below
hold.

A case that switches on `g_protected`, `licence` or `v_occupancy` also needs a
`fit_note_if_assumed` entry for that switch: the wording the brief uses when
that attribute is blank for a hotspot. Without it, a brief would state the
unknown as fact (the first real run had no licence data, and the deposit case
claimed the patch sat "inside a known concession"). The bank refuses to load a
case that is missing it. Rules for curating:

- Every claim in `evidence` carries a marker such as [1] pointing to a listed
  source. Every marker must resolve to a source and every source must be
  cited; the bank refuses to load otherwise.
- Read the source itself before quoting it. Mark each source `full_text` (the
  whole source was read), `passage` (the passage around the quote was read in
  the source, such as a law's article or a paper's abstract) or
  `search_excerpt` (only a search-engine excerpt was read). A search excerpt
  may not carry a quote and is flagged in the brief; the current bank has none.
- Give each read source a `locator` (article and clause for a law, page or
  section otherwise) and a verbatim English `quote` under 15 words. Quotes are
  kept short and the bank holds no full texts, which is why it can sit in a
  public repository; follow the link for the full text.
- List the policy text itself first where an English version exists. The
  overview links the case's name to the first source.
- Write the limits as carefully as the evidence. A case with mixed or
  unmeasured results belongs in the bank and is labelled as such.
- Set `reviewed_by_svw: true` only after SVW has signed the entry off.

## Caveats

- **No case is SVW-reviewed yet.** Every brief says so per option.
- **Laws are quoted from unofficial English translations.** The Vietnamese
  text is authoritative. The Decree 08/2022 translation predates later
  amendments, so the current wording of Article 37 needs checking; the case's
  limits say so.
- **No option currently grades as "ready to raise"**: each case has at least
  one precondition still marked unknown. That is the honest state of the bank.
- **The curator's precondition statuses are provisional** readings from desk
  research, to be replaced by SVW's and legal partners' judgment.
- **The protected-area layer predates the Kim Bang designation** (November
  2026), so Kim Bang's patches score and match as outside any protected area.
  The Kim Bang brief says so and asks for a check against the new boundary;
  the real fix is adding the boundary to the build step's protected-area
  layer.
- **Matching depends on the scorer input's governance columns.** Where
  `g_protected` or `g_unlicensed` is blank, options are listed on the
  assumption they apply, the brief names the missing attribute, and the
  option's "why it fits" is worded conditionally. On the first real run
  (2017 -> 2025) licence status is blank for every hotspot, because no
  concession list exists yet; the remediation-deposit option therefore always
  appears as conditional.
- **The summary step has not been run against a live endpoint yet**; its
  checks are covered by tests with a stubbed model.

## Maintaining this step

Where each kind of change lives:

| You want to | Touch | Notes |
| --- | --- | --- |
| add or edit a policy option | `policy_cases.yaml` | follow the curation rules above; the loader refuses malformed cases |
| change how many sites are briefed, options per brief, patches listed | `policy_config.yaml` (`max_briefs`, `max_instruments`, `max_precedents`, `top_patches_shown`) | every tunable is in this file, with a comment |
| map a new `change_class` from the scorer | `policy_config.yaml` → `drivers` | the run stops and names any unmapped class |
| change a site's display name | `policy_config.yaml` → `site_labels` | |
| change the wording a triage action leads with | `policy_config.yaml` → action templates | |
| change selection, grouping, matching or grading logic | `policy_bank.py` | docstrings follow the Method section above, step for step |
| change the plain-English overview wording | `overview.py` | templates only — never add a clause the run's fields can't fill |
| change the optional model summary or its checks | `narrate.py` | keep the checks; an unchecked summary must not ship |
| change the dashboard's compact copy | `dashboard.py` | copies strings from the briefs, writes no new text; the frontend reads the committed copy at `web/src/results/policy-dashboard-2025.json` |

After any change, run the tests — they cover case-bank validity (sources,
switches, preconditions, citation markers), grading, grouping and the output
contract on the sample data:

```bash
python -m pytest pipeline/policy-bank
```

`policy-briefs.json` is this step's contract with the dashboard: the field
list in **Run → Output** above is what `web` consumes, so renaming or
removing a field there needs a matching frontend change. Committed snapshots
of real runs live in [`results/`](results/README.md) with their code and
config versions, so a future run can be compared against what was handed
over.

The upstream fields this step reads (`priority`, `tier`, `action`,
`g_protected`, `g_unlicensed`, `v_occupancy`, …) are defined in the
priority-scoring step; their calculation is documented in
[`../priority-scoring/CALCULATIONS.md`](../priority-scoring/CALCULATIONS.md).

## Security

The bank and the briefs hold site names, tiers and policy text. No geometry or
coordinates enter this step. Review a brief before publishing it.
