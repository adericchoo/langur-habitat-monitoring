"""Optional summary paragraph for each brief, written by a language model.

The model is given one site brief's matched options as JSON and asked for a short
summary a manager can read aloud. The summary is kept only when it passes
check_narrative; a summary that fails is dropped and the brief goes out with
its rule-built sections alone, with the reason recorded in the JSON.

Works with any endpoint that speaks the chat-completions format (a local model
server or a hosted one), configured through environment variables:

    LLM_BASE_URL   e.g. http://localhost:11434/v1
    LLM_MODEL      the model name the endpoint expects
    LLM_API_KEY    only where the endpoint needs one
"""
import json, os, re, urllib.request

PROMPT = """You are helping a protected-area manager in Vietnam prepare for a board meeting.
Below is one site with flagged habitat-loss patches and the policy options matched to them from a curated case bank. Patches are grouped where they differ in protection or other attributes, and each group has its own options.

Write one paragraph of at most 120 words that says what was flagged at the site, which option is the most ready to raise and why, and what has to be confirmed first.

Rules:
- Use only the facts in the JSON. Add no policy, law, place, organisation or number that is not in it.
- Refer to each option you mention by its case_id in square brackets, e.g. [VN-PFES].
- Describe the patches as suspected changes from satellite screening.
- Plain sentences. No headings, no lists.

JSON:
{pack}
"""


def all_options(brief):
    return [o for g in brief["groups"] for o in g["options"]]


def evidence_pack(brief):
    """The subset of a site brief the model is shown."""
    def option(o):
        return ({k: o[k] for k in ("case_id", "name", "origin", "grade_label", "description",
                                   "howItFits", "evidence", "limitations")}
                | {"conditions": [f"{c['text']}: {c['status']}" for c in o["conditions"]]})
    return {
        "site": {k: brief[k] for k in ("site_name", "run_year", "top_priority", "top_tier", "action")}
                | {"patches": brief["patches"]},
        "groups": [{"patch_count": g["patch_count"], "context": g["context"],
                    "options": [option(o) for o in g["options"]]} for g in brief["groups"]],
    }


def check_narrative(text, pack):
    """Returns the list of problems with a model-written summary; empty means keep it.

    Checks that every bracketed case id is one of the brief's options, that at
    least one option is cited, that every number in the summary appears in the
    material the model was shown, and that the summary is within the word limit.
    """
    problems = []
    allowed = {o["case_id"] for g in pack["groups"] for o in g["options"]}
    cited = set(re.findall(r"\[([A-Z]{2}-[A-Z0-9-]+)\]", text))
    if cited - allowed:
        problems.append(f"cites cases not in this brief: {sorted(cited - allowed)}")
    if allowed and not cited:
        problems.append("cites no case")
    shown = json.dumps(pack, ensure_ascii=False)
    known = set(re.findall(r"\d+(?:[.,]\d+)*", shown))
    without_ids = re.sub(r"\[[^\]]*\]", " ", text)
    for number in set(re.findall(r"\d+(?:[.,]\d+)*", without_ids)):
        if number not in known:
            problems.append(f"number not in the source material: {number}")
    if len(text.split()) > 140:
        problems.append("longer than the word limit")
    return sorted(problems)


def call_model(prompt):
    base, model = os.environ["LLM_BASE_URL"].rstrip("/"), os.environ["LLM_MODEL"]
    body = json.dumps({"model": model, "temperature": 0,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    headers = {"Content-Type": "application/json"}
    if os.environ.get("LLM_API_KEY"):
        headers["Authorization"] = f"Bearer {os.environ['LLM_API_KEY']}"
    req = urllib.request.Request(f"{base}/chat/completions", data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)["choices"][0]["message"]["content"].strip()


def add_narratives(briefs, call=call_model):
    """Adds `narrative` to each brief whose summary passes, `narrative_rejected` otherwise."""
    for brief in briefs:
        if not all_options(brief):
            continue
        pack = evidence_pack(brief)
        text = call(PROMPT.format(pack=json.dumps(pack, indent=2, ensure_ascii=False)))
        problems = check_narrative(text, pack)
        if problems:
            brief["narrative_rejected"] = problems
        else:
            brief["narrative"] = text
