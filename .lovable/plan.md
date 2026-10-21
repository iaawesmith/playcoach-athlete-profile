# Grounded coaching feedback — prompt and system instructions

## What's wrong today (confirmed)

- The Slant (WR) template asks the model to "identify the one mechanic… name the phase, the body part, and the exact movement correction." With only numbers to go on, it invents the cause (stutter step, jam, hand fighting).
- Each metric reaches the model as just `Release Speed: 3.76mph (target X, score Y)`. It never sees what the metric measures (e.g. "hip speed over the first 10 frames off the line"), so it guesses.
- The model is never told who was in the clip. `people_in_video` is known to the analyzer but isn't in the prompt.
- Found while checking: the system instructions are sent **without filling in their placeholders**, so the model sees the literal text `{{athlete_level}}` and `{{focus_area}}`. That's why level and focus area currently have no effect.

## Changes

### 1. New prompt variables (analyzer, additive only)
- `{{metric_results}}` — each scored metric gets its description from the node, plus its value, target, score and phase. Format:
  `- Release Speed (Release phase): 3.76 mph, target X mph, score Y/100. Measures: <metric description>`
  (Kept under the same name so the template keeps working. This is the only format change.)
- `{{run_context}}` — new. One line per known fact: who was in the video (solo / with defender / multiple), camera angle, catch included or not, athlete level. Built from the run's stored context, not guessed.
- Fill placeholders in the system instructions too, using the same variables as the template.

No changes to scoring, metrics, weights, errors, phases, calibration, or the pose service.

### 2. Revised Slant (WR) system instructions (node prompt field, version 8 → 9)

```text
You are an elite wide receivers coach with 15 years of experience developing route runners. Keep all feedback under 150 words — no exceptions. Speak directly to the athlete in real coaching language. Be encouraging but honest.

Evidence rules — these override everything else:
1. Only state as fact what the measurements show: the metric, its value, its target, and what the metric measures (given in "Measures:"). Never describe a movement, footstep, hand action, or body position as if you saw it. You did not watch the video; you only have these numbers.
2. If you suggest why a number is low, frame it as something to check, not something that happened: "a slow first step often comes from X — look for it on your film." Give at most two possible causes, and only causes that fit what the metric measures.
3. Use only the people listed in the run context. If the athlete was alone, do not mention a defender, press, jam, hands at the line, a quarterback, a throw, or the ball in flight. Mention the catch only if the run context says a catch was included.
4. Never quote a number for a metric listed as not evaluated.
5. Drills and cues must target the measured weakness itself (e.g. acceleration out of the stance for low Release Speed), not a cause you guessed.

Adjust for {{athlete_level}}: Youth — simple language, build confidence. High School — direct coaching. College/Pro — technical, data-forward, no softening.

If a focus area is given ({{focus_area}}), address it — within the evidence rules.
If any metrics were not evaluated, open with one sentence acknowledging the incomplete rep, then proceed.
If confidence flags are present, acknowledge the filming issue in one sentence and move on.
```

### 3. Revised Slant (WR) prompt template

```text
Hey {{athlete_name}}, here's your {{node_name}} breakdown.

RUN CONTEXT (facts about this clip):
{{run_context}}

SCORE: {{mastery_score}}/100
{{phase_scores}}

WHAT WAS MEASURED (each line says what the metric measures):
{{metric_results}}

{{detected_errors}}

{{confidence_flags}}

{{skipped_metrics}}

COACHING BREAKDOWN: You are coaching a {{position}} on a {{node_name}}. Use position-appropriate terminology.

1. Lead with the single most important measurement — good or bad. Name the metric, the value, the target, and what it measures.
2. Name the weakest measured area and what it means on the field. If you offer a possible cause, phrase it as something to check on film ("this often comes from…; look for it"), one or two at most.
3. End with one drill or one cue that trains the measured weakness directly, for the very next rep.
```

`{{mastery_score}}` and `{{metric_results}}` are kept. Only the two prompt fields and the version change on the node; it stays LIVE at 100% readiness. Other nodes are untouched (they get the richer metric lines and run context automatically, and keep their own wording).

### 4. Replay 3e01efe2 three times (no new pose run)
- A replay action reads 3e01efe2's stored metric results, errors, scores and run context, builds the prompt through the same analyzer code, and calls the model three times.
- Read-only: nothing is written back to the result or any upload.
- I'll show you the full rendered prompt, the system instructions as sent, and all three responses, and check each for: no defender/press/jam/QB/ball-flight mentions, causes framed as "check," at most two, drill tied to release acceleration.

## Technical details
- `supabase/functions/analyze-athlete-video/index.ts`: `formatMetricResults` adds phase name + `Measures: <description>` (fallback: omit if no description); new `formatRunContext(context, upload)` using `normalizePeopleInVideo`; apply the variable substitution to `llm_system_instructions` before sending; record the rendered system text in diagnostics.
- Move the formatters into a pure `prompt.ts` so they're unit-tested from `src/test` (solo run omits other players; not-evaluated metrics carry no numbers; descriptions included).
- Replay: an admin-only mode on the analyzer (`replay_feedback_for_result_id`) that skips pose/scoring and only rebuilds the prompt from the stored row, returning prompt + response without saving. Removed or kept behind the same admin guard afterward — your call.
- Node update via a data change on node 75ed4b18 only: `llm_prompt_template`, `llm_system_instructions`, version 9, internal note explaining the change.
