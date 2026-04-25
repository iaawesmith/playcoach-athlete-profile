# Claude API Prompt Content Trace

**Investigation type:** Read-only empirical trace. No code changes.
**Date:** 2026-04-25
**Trace target:** Upload `66ea5e98-ff65-4d20-9e9e-232753d198aa`, node `75ed4b18-8a22-440e-9a23-b86204956056` (Slant), `status='complete'`, run on 2026-04-23.
**Edge function:** `supabase/functions/analyze-athlete-video/index.ts` (3,574 lines).

---

## Headline finding

**Neither `pro_mechanics` nor `phase_breakdown[].description` text reaches Claude.**

- The Mechanics tab content (`pro_mechanics`) is **never read by the edge function**. Grep returns zero matches.
- The Phases tab description content (`phase_breakdown[].description`) is read but **discarded** — only `phase_breakdown[].name` is used, formatted into a single `phase_scores` line.
- This **contradicts the Mechanics tab Knowledge Base documentation**, which claims the content reaches Claude. The Knowledge Base is wrong and needs to be updated (tracked as separate backlog item; not in scope here).

The only thing about phases that reaches Claude is a score line:
> `Release: 14/100, Stem: 0/100, Break: 50/100, Catch Window: 100/100, YAC (After Catch): 0/100`

---

## Section 1 — Full reconstructed Claude API request

Reconstructed from `athlete_lab_results.result_data.log_data.claude_api` (persisted run log) plus the live node template and system instructions read directly from `athlete_lab_nodes`.

### System parameter

Sent verbatim as the `system:` field at line 3247. Value is `nodeConfig.llm_system_instructions` with **no variable substitution** (substitution loop runs only on `prompt`, lines 3201–3205).

```text
You are an elite wide receivers coach with 15 years of experience developing route runners at every level. Keep all feedback under 150 words — no exceptions. Speak directly to the athlete in real coaching language. Be encouraging but honest — name poor technique and fix it. Every piece of feedback must reference specific measurements from the analysis data. Never give general feedback that could apply to any athlete.

Adjust for {{athlete_level}}: Youth — simple language, build confidence. High School — direct coaching, name the mechanic. College/Pro — technical, data-forward, no softening.

If {{focus_area}} is provided, reference it directly in the coaching breakdown.

If {{skipped_metrics}} is not empty, open with one sentence acknowledging the incomplete rep, then proceed.

If confidence flags are present, acknowledge the filming issue in one sentence and move on.
```

- **Total chars:** 881 (matches `system_instructions_chars: 881` in run log)
- **Total words:** ~145
- **Critical observation:** `{{athlete_level}}`, `{{focus_area}}`, `{{skipped_metrics}}` reach Claude as **literal `{{...}}` strings**. The substitution loop never runs against `system`. See Adjacent Findings.

### User message (`messages[0].content`)

After substitution against the live values from the run log:

```text
Hey Athlete, here's your Slant breakdown.

SCORE: 68/100
Release: 14/100, Stem: 0/100, Break: 50/100, Catch Window: 100/100, YAC (After Catch): 0/100

WHAT THE DATA SHOWS:
Plant Leg Extension: 146.34degrees (target 140degrees, score 100/100)
[remaining scored metrics formatted by formatMetricResults — one per line, same shape]





COACHING BREAKDOWN: You are coaching a  on a Slant. Use position-appropriate terminology, standards, and framing when describing technique and corrections.

Lead with the single most important thing the data shows — good or bad. Name the specific metric, the measured value, and what it means on the field. Then identify the one mechanic that if fixed would have the biggest impact on the next rep. Be specific — name the phase, the body part, and the exact movement correction.

End with one drill or one cue the athlete can execute on their very next rep.
```

- **Total chars:** ~1,960 (consistent with `prompt_tokens: 490` × 4)
- **Total words:** ~330
- **Note:** `{{position}}` substituted to empty string (live node had `position: null` at trace time), producing the readable artifact `"coaching a  on a Slant"` (double space). Per-user one-field fix in admin UI; no code change required.
- **Note:** Three blank lines between `WHAT THE DATA SHOWS` block and `COACHING BREAKDOWN` are the empty `{{detected_errors}}`, `{{confidence_flags}}`, `{{skipped_metrics}}` substitutions. Legitimate runtime emptiness for this rep.

---

## Section 2 — Content source map

100% accounting. Every distinct piece of the assembled prompt + system parameter, mapped to its source.

| Content snippet (first ~50 chars) | Source field on `athlete_lab_nodes` | Tab in admin UI |
|---|---|---|
| `Hey {{athlete_name}}, here's your {{node_name}}...` (template scaffold) | `llm_prompt_template` | LLM Prompt |
| `Athlete` (substituted into `{{athlete_name}}`) | n/a — `analysis_context.athlete_name`, defaulted | runtime context |
| `Slant` (substituted into `{{node_name}}`) | `name` | Basics |
| `68` (substituted into `{{mastery_score}}`) | computed from metrics × weights | runtime |
| `Release: 14/100, Stem: 0/100, Break: 50/100, ...` | **`phase_breakdown[].name` only** (descriptions stripped) | Phases |
| `Plant Leg Extension: 146.34degrees (target 140degrees...` | `key_metrics[].name`, `.elite_target`, `.unit` + computed score | Metrics |
| _(empty)_ for `{{detected_errors}}` | `common_errors[]` (none triggered) | Errors |
| _(empty)_ for `{{confidence_flags}}` | computed from per-metric confidence | runtime |
| _(empty)_ for `{{skipped_metrics}}` | computed | runtime |
| _(empty)_ for `{{position}}` | `position` (live value: `null`) | Basics |
| `COACHING BREAKDOWN: You are coaching a ...` (template scaffold) | `llm_prompt_template` | LLM Prompt |
| `You are an elite wide receivers coach...` (system param) | `llm_system_instructions` | LLM Prompt |
| `{{athlete_level}}`, `{{focus_area}}`, `{{skipped_metrics}}` literals inside system | unsubstituted template tokens — bug | LLM Prompt |

### Fields that exist on the node but are NOT in the prompt

`pro_mechanics`, `phase_breakdown[].description`, `phase_breakdown[].proportion_weight`, `phase_breakdown[].frame_buffer`, `phase_breakdown[].sequence_order`, `overview`, `scoring_rules`, `common_errors[].description`, `form_checkpoints`, `badges`, `knowledge_base`, `camera_guidelines`, `reference_object`, `solution_class`, `score_bands`, all reference/calibration fields, all keypoint mappings, `llm_tone`.

**None of these reach Claude.** See Adjacent Findings P2 audit item.

---

## Section 3 — Phase descriptions vs Mechanics coaching cues

**Direct answer: NEITHER reaches Claude as text content.**

### Phase descriptions
`phase_breakdown[].description` is read by `formatPhaseScores` (line 3555) which uses **only** `p.name` to format the `{{phase_scores}}` line. The `description` field is touched but discarded.

### Mechanics coaching cues
`pro_mechanics` is **never read by the edge function**. `rg "pro_mechanics" supabase/functions/analyze-athlete-video/index.ts` returns zero matches. Field is functionally orphaned in the runtime pipeline.

### Content overlap finding (separate but critical)

The admin has been authoring coaching cues inside `phase_breakdown[].description` text using a `— Coaching cues —` separator. Inspection of the live Slant node confirms the cue text under that separator inside `description` is **byte-for-byte identical** to the corresponding entry in `pro_mechanics[].content` (matched by `phase_id`). The Mechanics tab and the Phases tab are storing the exact same coaching cues twice. **Neither copy reaches Claude.**

### Where the unused fields ARE consumed
- `phase_breakdown[].description` → only displayed in the admin UI Phases tab editor and in node copy-export.
- `pro_mechanics[]` → only displayed in the admin UI Mechanics tab and in node copy-export. Functionally dead in the runtime pipeline.

---

## Section 4 — Edge function code path

File: `supabase/functions/analyze-athlete-video/index.ts`

### 1. Read `phase_breakdown` from node config
- Line 885: selected from DB as part of node config payload.
- Line 722, 728: used for phase windows / keypoint analysis.
- Line 764: `buildMetricLogEntries(metricResults, phaseWindows, nodeConfig.phase_breakdown)`.
- Line 1154: `resolveBreakPhaseDetFrequency(nodeConfig?.phase_breakdown)`.
- Line 3164: `formatPhaseScores(scoreResult.phase_scores, nodeConfig.phase_breakdown)` — only consumer that touches the prompt path.

### 2. Read `pro_mechanics` from node config
**Does not occur.** `rg "pro_mechanics" supabase/functions/analyze-athlete-video/index.ts` returns no matches. The field is selected from DB along with the rest of the node row, but never read.

### 3. Format each into Claude prompt context

`formatPhaseScores` — lines 3555–3560:

```ts
function formatPhaseScores(phaseScores: Record<string, number>, phases: any[]): string {
  if (!phaseScores || !phases) return ''
  return phases
    .map(p => `${p.name}: ${Math.round(phaseScores[p.id] || 0)}/100`)
    .join(', ')
}
```

Only `p.name` used. `p.description` discarded. **No mechanics formatter exists.**

### 4. Inject each into the final prompt

Lines 3162–3205:

```ts
const variables = {
  mastery_score: scoreResult.aggregate_score?.toString() || 'N/A',
  phase_scores: formatPhaseScores(scoreResult.phase_scores, nodeConfig.phase_breakdown),
  metric_results: formatMetricResults(metricResults),
  confidence_flags: formatConfidenceFlags(metricResults),
  detected_errors: errorResults.detected.length > 0
    ? `Confirmed errors observed: ${errorResults.detected.join(', ')}`
    : '',
  athlete_name: context.athlete_name || 'Athlete',
  node_name: nodeConfig.name,
  position: nodeConfig.position || '',
  athlete_level: context.athlete_level || 'high_school',
  focus_area: context.focus_area || '',
  skipped_metrics: scoreResult.skipped_metrics
    ? `Note: ${scoreResult.skipped_metrics} were not evaluated on this rep (no catch recorded).`
    : ''
}
let prompt = template
for (const [key, value] of Object.entries(variables)) {
  prompt = prompt.replaceAll(`{{${key}}}`, value as string)
}
```

The substitution dictionary is exhaustive — there is no `phase_descriptions` or `mechanics` key. Even if an admin added `{{phase_descriptions}}` or `{{mechanics}}` to the LLM Prompt template, the loop has no value to inject and the literal token would survive into the API call.

Final API call — lines 3237–3250:

```ts
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5',
    max_tokens: nodeConfig.llm_max_words ? nodeConfig.llm_max_words * 2 : 500,
    system: nodeConfig.llm_system_instructions || '',
    messages: [{ role: 'user', content: prompt }]
  })
})
```

`system:` uses raw `llm_system_instructions` — the variable substitution loop above never runs against `system`, so any `{{...}}` tokens in system instructions leak through as literals.

---

## Section 5 — Variable substitution audit

From the persisted run log (`result_data.log_data.claude_api.variables_injected`):

| Template variable | Resolved value | Status |
|---|---|---|
| `{{mastery_score}}` | `"68"` | present |
| `{{phase_scores}}` | `"Release: 14/100, Stem: 0/100, Break: 50/100, Catch Window: 100/100, YAC (After Catch): 0/100"` | present (names + scores only — **no description text**) |
| `{{metric_results}}` | scored metrics formatted as `Name: value+unit (target..., score N/100)` | present |
| `{{confidence_flags}}` | `""` | empty (no flags this run) |
| `{{detected_errors}}` | `""` | empty (none triggered) |
| `{{athlete_name}}` | `"Athlete"` (default — context didn't supply name) | present (default) |
| `{{node_name}}` | `"Slant"` | present |
| `{{position}}` | `""` | **empty — node `position` field is `null`** |
| `{{athlete_level}}` | `"high_school"` (default) | present (default) |
| `{{focus_area}}` | `""` | empty |
| `{{skipped_metrics}}` | `""` | empty |

**No template variable is supposed to receive phase descriptions or mechanics content.** There is no `{{phase_descriptions}}`, `{{mechanics}}`, `{{coaching_cues}}`, or equivalent in either the live template or the substitution dictionary.

Run log `missing_variables: [confidence_flags, detected_errors, focus_area, skipped_metrics]` — all empty for legitimate runtime reasons (no flagged metrics, no triggered errors, no focus area set, no skipped metrics). **Not bugs.**

---

## Section 6 — Empirical findings (recommendation)

1. **Is the Mechanics tab content reaching Claude?** **No.** `pro_mechanics` is read zero times in the edge function. It exists only in the admin UI and the copy-export. **This contradicts the Mechanics tab Knowledge Base documentation.**

2. **Is the Phases tab description content reaching Claude?** **No, not as text.** Only `phase_breakdown[].name` reaches Claude, formatted into a single score line. The `description` body — including any `— Coaching cues —` block the admin pasted inside it — is discarded.

3. **If both are reaching Claude, is the content distinct enough to justify two tabs?** N/A — neither is reaching Claude. Separately, inspection of the live Slant node confirms the admin has been duplicating the same coaching cue text into both `pro_mechanics[].content` AND the lower half of `phase_breakdown[].description` (under a `— Coaching cues —` separator). Same content, two storage locations, neither used at runtime.

4. **If the Mechanics tab were removed, what would Claude lose?** **Nothing.** Claude already receives nothing from `pro_mechanics`. Removing the tab has zero effect on the prompt sent to Claude. The only loss is the admin-facing UI surface for authoring/reviewing those cues — which is currently being duplicated into Phases anyway.

---

## Adjacent findings (durable, not in scope here)

These are real findings surfaced during the trace. They are NOT being acted on in this investigation. They are recorded here so they don't get lost and to feed the Progress Tracker when it's built.

### AF-1 — System parameter does not run variable substitution
**Severity:** P0 M
**Location:** edge function lines 3201–3247.
**Symptom:** The substitution loop runs against `prompt` only. The `system:` field passes `nodeConfig.llm_system_instructions` raw. Tokens `{{athlete_level}}`, `{{focus_area}}`, `{{skipped_metrics}}` in the system instructions reach Claude as literal `{{...}}` strings.
**Impact:** Athlete-level adaptation (Youth / HS / College/Pro) instruction is broken. Focus-area and skipped-metrics conditional behavior in system instructions is broken.
**Fix shape:** Run the same substitution loop against `system` before passing to the fetch body. Then verify the run log records the substituted system as well as substituted prompt.

### AF-2 — Live Slant node has `position: null`
**Severity:** Authoring fix, not code.
**Symptom:** `{{position}}` substitutes to empty string, producing `"coaching a  on a Slant"` (double space) in the prompt.
**Fix shape:** Set `position = "WR"` on the Slant node via the admin UI Basics tab. One-field update. Takes effect on next analysis. No code change.

### AF-3 — Phases `description` field is dual-purpose
**Severity:** Architectural.
**Symptom:** Admin uses a `— Coaching cues —` separator inside `phase_breakdown[].description` to pack two distinct content types into one field. The lower half is byte-identical to the same phase's `pro_mechanics[].content`.
**Implication:** When phase context is eventually wired into Claude (Phase 1c), an architectural decision is required: keep one field with the separator convention, or split into `description` + `coaching_cues` as proper schema. Affects how authors author and how the edge function formats.

### AF-4 — `pro_mechanics` is functionally orphaned
**Severity:** Tech debt, decision required.
**Symptom:** Field is selected from DB but never consumed by the runtime pipeline. Only consumer is the admin UI and copy-export.
**Decision required:** Either wire it into the prompt (and resolve AF-3 collision), or remove the field and the Mechanics tab entirely. Migration is mostly empty since content is duplicated in `phase_breakdown[].description` already.

---

## Methodology notes

- Source of truth for the assembled prompt: `athlete_lab_results.result_data.log_data.claude_api` for upload `66ea5e98-...` (the persisted run log captures `variables_injected`, `prompt_tokens`, `system_instructions_chars`, etc.). Cross-checked against the live node config in `athlete_lab_nodes` for template + system text.
- Code path verification: full grep across the edge function for `pro_mechanics`, `coaching_cue`, `phase.*description`, `p\.description` — zero matches outside `formatPhaseScores`, which uses `p.name` only.
- Formatter inspection: `formatPhaseScores` (line 3555), `formatMetricResults` (line 3562), `formatConfidenceFlags` (line 3569). All three produce short structured strings; none of them include phase or mechanics narrative text.
