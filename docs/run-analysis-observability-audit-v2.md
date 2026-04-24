# Run Analysis — Observability Audit v2 (post-Phase 1)

Status: post-Phase 1, pre first real admin test upload.
Lens: not "what data is available?" but "what does an admin LEARN from
a test, and what signals help them improve the pose model and coaching
quality over time?"

Source files audited:
- `src/features/athlete-lab/components/TestingPanel.tsx` (1088 lines)
- `src/features/athlete-lab/components/AnalysisLog.tsx` (546 lines)
- `src/features/athlete-lab/types.ts` (`AnalysisLogData`, `PipelineAnalysisResult`)
- `supabase/functions/analyze-athlete-video/index.ts` (3554 lines)
- `supabase/migrations/20260424220706_*.sql` (Group B node config)

---

## Section 1 — Current State (post-Phase 1)

### 1.1 Phase 1 additions reflected in this audit

| # | Phase 1 change | Where it lives now |
|---|---|---|
| A | 4 metrics renamed/repurposed (Plant Leg Extension, Hip Stability, Release Speed, Hands Extension at Catch) | `athlete_lab_nodes.key_metrics` JSON; rendered in TestingPanel "Metric Results" card and AnalysisLog "3. Metric Calculations" |
| B | `distance_variance` calculation type | `analyze-athlete-video/index.ts` switch case L2214; dedicated `logInfo('distance_variance_calculated', …)` at L2648 / L2656 / L2669 |
| C | `scoring_config_applied` log | `analyze-athlete-video/index.ts:3035` — confidence_handling, min_metrics_threshold, renormalize_on_skip, totals |
| D | `variables_injected` log | `analyze-athlete-video/index.ts:3167` (logInfo) AND `claudeLog.variables_injected` (L3191) surfaced into `AnalysisLogData.claude_api.variables_injected` |
| E | Pose quality skip banner (Claude SKIPPED amber callout) | `TestingPanel.tsx:1047-1063` — reads `result.log_data.claude_api.status === "SKIPPED"` and `skipped_reason` |
| F | State resync on `node.updated_at` + admin Refresh button | `AthleteLab.tsx:13,46,103-112` — manual refresh + `refreshNodes({ silent })` on focus |
| G | 5 legacy banners removed; "Camera" → "Filming Guidance" | NodeEditor / Pipeline tabs |
| H | 4 weight-sum UI bugs fixed (active-only filtering) | NodeEditor Scoring + Readiness widgets |
| I | `internal_documentation` field + markdown rendering | `types.ts:28`, `KeyMetricsEditor.tsx:412/427/434/438` (ReactMarkdown), exported in `nodeExport.ts:146` |

### 1.2 Run Analysis surface — what now exists

Top-down inventory of every panel rendered in the Testing tab after a
successful run, in the order an admin sees them:

1. **Analysis Context card** (`TestingPanel.tsx:498-654`)
   - Camera Angle, People in Video, Break Direction, Catch status,
     Athlete Level, Focus Area, Body Calibration (height + wingspan).
   - Toggle to disable. Copy-to-clipboard button.
   - All values flow through to the `analyze-athlete-video` payload
     and are echoed in the AnalysisLog.

2. **Video upload card** (L656-728): file drop, URL paste, performance
   description, clip end seconds (clamped to 3s).

3. **Pipeline Status card** (L730-775): stage icon + label, upload ID,
   6-segment progress bar, latest progress message, preparation note,
   timed-out / cancelled hints.

4. **Run / Cancel buttons** (L777-801).

5. **Error card** (L804-830) when `runStage === "failed" | "timed_out"`.

6. **Empty state** (L832-856) — six "what you'll see" tiles.

7. **Result panels** (L858-1083), in order:
   - **Production Analysis Score** card: aggregate score badge, status,
     analyzedAt, resultId.
   - **Phase Breakdown** grid: per-phase score badge + bar.
   - **Metric Results** list: per-metric row with name, phase, calc type,
     status, weight, measured value/unit, elite target, deviation,
     reason, optional Calibration sub-card (source / confidence /
     pixels per yard / raw JSON).
   - **Confidence Flags** + **Detected Errors** (two-column).
   - **Pose Quality Audit** callout (only when `aggregateScore === 0`
     OR ≥60% of metrics flagged as low-confidence) — person detected
     yes/no, average keypoint confidence, reliable frame %, most common
     issue, generic film-it-better tip.
   - **Coaching feedback skipped** amber banner (Phase 1 addition,
     L1047-1063) — only when `claude_api.status === "SKIPPED"`.
   - **Feedback** card — Claude paragraph(s).
   - "Re-run with Different Video" button.

8. **AnalysisLog accordion** (`AnalysisLog.tsx`) at the bottom — five
   collapsible sections, each with a derived PASS / WARN / ERROR badge:
   1. Pre-Flight Validation — checks with name / expected / actual / result.
   2. Pose Engine Output — solution_class, model, backend, total_frames,
      source_fps, processing_time_ms, phase_windows table, **per-keypoint
      confidence summary** (mean, min, frame, percent_below, status,
      auto WARN line for any kp below 20% threshold).
   3. Metric Calculations — per-metric: phase, frames evaluated, frame
      range, keypoints, calc type, temporal window, extracted values,
      result + unit, elite target, deviation, raw score, weighted
      contribution, status, skip reason. Followed by "Aggregate Score
      Calculation" block.
   4. Error Detection — per error: name, auto_detectable, condition,
      metric_value, evaluation_expression, triggered yes/no, "passed
      to Claude as fact / context" footer.
   5. Claude API — model, system instructions presence + chars,
      **template variables injected (Phase 1 D)**, missing variables,
      token usage breakdown (system / template / variable / prompt /
      response / total), word count vs target, truncated, status.
   - "Copy Log" button generates a markdown export of all five sections.

### 1.3 Underlying data shape

`AnalysisLogData` (`types.ts:260-309`) is the contract between edge
function and UI. Phase 1 added `variables_injected`, `missing_variables`,
`skipped_reason`, and `status: SKIPPED` on `claude_api`. The
**`scoring_config_applied`** event and **`distance_variance_calculated`**
event are **not** in this type — they are `logInfo` calls only, visible
in Cloud Edge Function logs but not in `result.log_data`.

---

## Section 2 — What an admin sees after a test

Walking the experience top-down:

| Question | Answer (with UI location) |
|---|---|
| First thing the admin sees | **Production Analysis Score** card (`TestingPanel.tsx:860`). A single 0–100 number with a colored ring (success / warning / danger). |
| Immediately visible without clicks | Aggregate score, status string, analyzed timestamp, result ID, all phase scores, all metric rows (name + score + weight + measured + target + deviation + reason), confidence-flag list, detected-errors list, pose-quality-audit (when triggered), Claude SKIPPED banner (when triggered), Claude feedback paragraph. |
| Hidden behind clicks | Per-metric calibration sub-card (rendered when calibration data exists, but the raw JSON is only readable on hover/scroll). The entire **AnalysisLog accordion** sections (Pre-Flight, Pose Engine, Metric Calculations, Error Detection, Claude API) collapse to one-line headers and require a click each to expand. The accordion itself starts collapsed. |
| Hidden entirely (logs-only) | `scoring_config_applied` (proves the right scoring config was honored); `distance_variance_calculated` (frame-level pixel/yard stats per Hip-Stability run); the raw `logInfo('variables_injected', …)` payload that includes the `used_in_template` flag; preflight failure stop reasons not surfaced when preflight passed; per-frame keypoint coordinate trails. |
| Is the result trustworthy? | Partial. The PASS/WARN/ERROR badge on the AnalysisLog header gives an at-a-glance verdict (overall + per-section). The Pose Quality Audit + Claude SKIPPED banner together signal "do not trust this." But **there is no top-level trust verdict on the score card itself** — a 68 is rendered identically whether 4-of-4 metrics scored cleanly or 2-of-4 were flagged with marginal keypoints. |
| Is the meaning of each metric value clear? | Partial. Each metric row shows `name + phase + calc_type + measured + unit + elite_target + deviation + reason`. **What it doesn't show**: the metric's `internal_documentation` (the Phase 1 source-of-truth for what the number means and why the target is what it is). To read it the admin has to leave the Testing tab and open the Metrics tab editor. |
| Can the admin distinguish the four pipeline outcomes? | |
| ↳ Pipeline worked + athlete performed well | Yes. High score (≥80), no skipped/flagged metrics, AnalysisLog overall PASS, no Pose Quality Audit, no SKIPPED banner. |
| ↳ Pipeline worked + athlete performed poorly | Mostly. Low score with all four metrics scored (not flagged), AnalysisLog overall PASS, **but the UI does not say "the pipeline ran cleanly, this is real."** The admin must infer from the absence of warnings. |
| ↳ Pipeline worked + metric is misconfigured | **Not clearly distinguishable.** A "geometry says 146°, target 45°" mis-target case (the exact bug Phase 1 fixed) renders as score=0 with reason="deviation_exceeds_max" — the same UI state as "athlete performed badly". Admin has to manually compare measured value vs the metric's documented elite range to spot a target/geometry mismatch. |
| ↳ Pipeline failed + result shouldn't be trusted | Yes when severe (Claude SKIPPED banner + Pose Quality Audit fire together). Less clear when partial — a single low-confidence keypoint will WARN inside the AnalysisLog accordion but not on the score card. |

---

## Section 3 — What the admin is likely to WANT after a test

Coverage rating: **F** = Fully covered, **P** = Partially covered, **N** = Not covered.

| Need | Current UI surface | Coverage |
|---|---|---|
| Validate the pipeline produced correct measurements | AnalysisLog → Metric Calculations gives raw value + frames + keypoints used + calc type + extracted values. | **F** |
| Understand why each metric scored what it did | Metric row shows measured / target / deviation / reason. AnalysisLog adds raw_score + weighted_contribution. **Missing**: the metric's `internal_documentation` (target derivation rationale). | **P** |
| Compare this run against previous runs | No comparison view exists. The admin sees only the latest run; previous runs persist in `athlete_lab_results` but are not surfaced in the Testing tab. | **N** |
| Share findings with a coach or engineer | "Copy Log" button produces a comprehensive markdown export. Upload ID + result ID are copyable. **Missing**: shareable URL of a specific run, screenshot of the Result panel. | **P** |
| Refine metric targets based on real data | The Metrics tab editor is one tab away. **Missing**: the inline ability to see "this metric's last 10 measured values across runs" while editing the target. The admin tunes blind to historical distribution. | **N** |
| Debug when something looks wrong | AnalysisLog accordion is the primary tool — preflight, keypoint confidence per index, frame ranges, raw extracted values, evaluation expressions for error detection, Claude variable injection. **Missing from UI**: `scoring_config_applied` (proves config wasn't silently overridden) and `distance_variance_calculated` frame-level breakdown — both exist only in Cloud edge logs. | **P** |
| Trust the result enough to show to an athlete | Pose Quality Audit + Claude SKIPPED banner protect the worst case. AnalysisLog overall PASS/WARN/ERROR badge is a useful aggregate. **Missing**: a single "Athlete-safe / Admin-only / Do-not-show" verdict on the score card itself, taking calibration confidence + pose reliability + skipped-metric % into account. | **P** |

---

## Section 4 — Model quality feedback loops

The elite-UX question. How does the system learn from each test?

### 4.1 Tuning a metric target after a cohort run

> "We notice Release Speed consistently scored below 50 across 20 clips. How do we know whether the target (7 mph) is wrong or the athletes are slow?"

| What we'd need | Exists today? |
|---|---|
| The 20 measured values, joined with athlete level, camera angle, calibration confidence | Stored in `athlete_lab_results.result_data.metricResults[*].value` and `athlete_uploads.analysis_context`. **No UI surfaces it.** |
| A distribution view (histogram, mean, median, p25/p75) for a single metric across runs | Not built. |
| Filter by `analysis_context.athlete_level` so we tune separately for HS vs college vs pro | Context is captured on every run; not surfaced in any aggregate UI. |
| Indication of which runs had Pose Quality Audit fire (so we exclude bad-pose runs from tuning) | The flag exists per-run in `result.log_data`; not aggregated. |

**Status: NOT COVERED.** Tuning today requires a SQL query against
`athlete_lab_results` joined with `athlete_uploads`, by hand, by an
engineer. This is the single biggest missing feedback loop.

### 4.2 Detecting an unreliable keypoint in a specific camera angle

> "Is landmark 29 (left heel) unreliable when filmed from the sideline?"

| What we'd need | Exists today? |
|---|---|
| Per-keypoint confidence summary on every run | **Yes** — `log_data.rtmlib.keypoint_confidence[*].percent_below`, surfaced in AnalysisLog Section 2 with WARN auto-line at >20%. |
| Cross-run aggregation of `percent_below` for a single `kp.index`, sliced by `analysis_context.camera_angle` | **No.** The data is stored per run; no view aggregates across runs. |
| A heatmap or table of "kp.index × camera_angle → median percent_below" | Not built. |

**Status: NOT COVERED at the cohort level. PARTIAL per single run.**

### 4.3 Comparing Claude prompt template versions

> "We changed the prompt last week. Did coach quality improve?"

| What we'd need | Exists today? |
|---|---|
| Version stamp on every Claude run | Partial — `node.node_version` is persisted in `athlete_lab_results.node_version`, but the prompt template is part of the node, not separately versioned. A small template tweak that doesn't bump `node_version` is invisible. |
| A way to diff Claude outputs between two prompt versions on the same upload | Not built. The result is overwritten on re-run; no "what would the new prompt say about this old upload" replay. |
| Captured prompt + response text for retroactive evaluation | Prompt is **not stored**. Only `feedback` (response) and token counts. |

**Status: NOT COVERED.** Today, prompt iteration is fly-by-feel.

### 4.4 Identifying scoring-by-coincidence

> "What if Plant Leg Extension target=140° happens to match noise rather than real plant geometry?"

| What we'd need | Exists today? |
|---|---|
| A way to validate the measured value against ground-truth annotation (admin marks "this frame is the true plant moment") | Not built. There is no annotation surface anywhere in the app. |
| Variance of measured value across multiple takes by the same athlete | Possible via SQL on `athlete_lab_results`; no UI. |
| Visual overlay of the keypoint trail on the source video so the admin can eyeball "the angle being measured is the angle I expect" | Not built. The source video is not even rendered alongside the result. |
| Frame-by-frame extracted values | **Partially** — `MetricLogEntry.extracted_values` is a single string (e.g. an array dump), shown once in AnalysisLog Section 3. Not visualized over time. |

**Status: NOT COVERED.** The Phase 1 `internal_documentation` is the
*written* defence against scoring-by-coincidence (it documents target
derivation), but there's no *measured* defence.

---

## Section 5 — Specific UI refinement opportunities

UX elevation, not bug fixes. Each rated for effort (S/M/L/XL),
value-to-first-test (low/med/high), and dependency.

| # | Idea | Effort | Value | Dependency |
|---|---|---|---|---|
| 5.1 | **Trust verdict pill on the Score card.** Roll up calibration confidence + pose reliability + skipped-metric % + Claude status into one of {Athlete-safe / Admin-only / Do-not-show}. Place next to aggregate score. | S | High | None |
| 5.2 | **Inline metric documentation.** Render `internal_documentation` (markdown) inside each metric row in the Testing tab via a "Why this number?" disclosure. Text already exists (Phase 1 I); only a UI consumer is missing. | S | High | None |
| 5.3 | **Surface `scoring_config_applied` in AnalysisLog.** Add a "0. Scoring Config Applied" section above Pre-Flight showing `confidence_handling`, `renormalize_on_skip`, `min_metrics_threshold`, totals. Catches the silent-fallback class of bug Phase 1 already wrote the log for. | S | High | Edge function must include the payload in `log_data` (currently logInfo only). |
| 5.4 | **Surface `distance_variance_calculated` per-metric.** When `calculation_type === 'distance_variance'`, render the per-frame stdDev/mean/min/max alongside the metric row. | S | Med | Same edge-function passthrough as 5.3 |
| 5.5 | **Last-N runs strip.** Above the Score card, show 5 thumbnails of the athlete's last 5 runs on this node with score deltas. Click → load that run's `log_data` into the panel. | M | High | None (data already in `athlete_lab_results`) |
| 5.6 | **Cohort distribution sparkline per metric.** In each metric row, a tiny histogram of all measured values for this metric on this node across the last 50 runs. Tells the admin "your target sits at the 80th percentile" at a glance. | M | High | Aggregation query / view |
| 5.7 | **Run A vs Run B compare mode.** Pick two upload IDs; render side-by-side score cards, metric rows, and AnalysisLog sections with diff highlighting. | L | Med | None |
| 5.8 | **Source-video overlay with keypoint trails.** Render the analyzed video with detected pose drawn on top, scrubbable, and the metric's measured frame range highlighted. | XL | High | Needs the per-frame keypoint array to be persisted (currently only the summary survives in `athlete_lab_results.result_data`). May need Phase 3 world_landmarks for the 3D version. |
| 5.9 | **Annotate "true break frame" tool.** Admin scrubs to the actual plant frame and clicks; that timestamp is stored as ground truth on the upload. Future runs can be evaluated against it for measurement-vs-truth deviation. | L | Med (high once Phase 3 lands) | Depends on 5.8 |
| 5.10 | **Prompt diff & replay.** Capture and version the Claude prompt independently of `node_version`; allow re-running a stored upload against a new prompt without re-running the pose pipeline. | L | High (for prompt iteration) | Edge function refactor: split pose stage from feedback stage; persist raw prompt. |
| 5.11 | **Calibration overlay.** When calibration came from body height + wingspan, show the inferred horizon line / pixels-per-yard scale bar overlaid on a representative frame. Lets the admin spot calibration drift. | M | Med | Depends on 5.8 (frame rendering) |
| 5.12 | **"Show on athlete view" preview button.** From a run, jump straight to the athlete-facing render of the same data with no admin-only fields. Confirms the trust-verdict before sharing. | S | Med | Athlete-facing result view must exist (current scope unclear). |

---

## Section 6 — Recommendations

### 6.1 CRITICAL — before first real admin test upload

1. **Surface `scoring_config_applied` in `log_data`** (Idea 5.3).
   The log exists; the UI doesn't. Without it, the admin cannot
   confirm during the first real test that the right node config
   was honored. Phase 1 spent significant effort on this exact
   class of bug — leaving the proof invisible undermines that work.
   *Scope:* edge function — extend `log_data` payload; add
   AnalysisLog Section 0. *Dep:* none.

2. **Trust verdict pill on the Score card** (Idea 5.1).
   Avoids the failure mode where a 68 from a marginal-pose run is
   shown to an athlete because the admin missed the Pose Quality
   Audit four panels down. *Scope:* TestingPanel L860 card,
   single derived prop. *Dep:* none.

3. **Inline `internal_documentation` per metric row** (Idea 5.2).
   The whole point of Phase 1's documentation work was to make
   target derivation legible. Today that text is only in the
   editor tab. Surface it in the Testing tab where the admin is
   actually questioning the number. *Scope:* one disclosure per
   metric row; ReactMarkdown already imported. *Dep:* none.

### 6.2 VALUABLE — high-impact polish before the test

4. **Surface `distance_variance_calculated` payload per Hip-Stability
   metric** (Idea 5.4). Hip Stability is the headline new
   calculation type. Surfacing the per-frame breakdown converts
   "0.19 yd stdDev" from a number into a story.

5. **Last-N runs strip** (Idea 5.5). The first real test will be
   followed by a second and a third. Without comparison, the admin
   re-derives "is this getting better?" from memory.

### 6.3 Phase 6 — observability enhancements

6. Cohort distribution sparkline per metric (5.6).
7. Run A vs Run B compare mode (5.7).
8. Per-keypoint × camera-angle reliability table (Section 4.2).
9. Prompt versioning + replay without re-running pose (5.10).

### 6.4 Phase 7+ — advanced features

10. Source-video overlay with keypoint trails (5.8).
11. Annotation tool for ground-truth break frames (5.9).
12. Calibration overlay (5.11).
13. Athlete-view preview button (5.12).

---

## Appendix A — Audit notes & verifications

- Confirmed Phase 1 log emissions in
  `supabase/functions/analyze-athlete-video/index.ts`:
  `distance_variance` switch case (L2214), `distance_variance_calculated`
  logInfo (L2648 / 2656 / 2669), `scoring_config_applied` (L3035),
  `variables_injected` logInfo (L3167) and the version surfaced into
  `claudeLog.variables_injected` for `log_data` (L3191).
- Confirmed `internal_documentation` is rendered with ReactMarkdown in
  the editor (`KeyMetricsEditor.tsx:438`) and exported in
  `nodeExport.ts:146`. No consumer in TestingPanel today.
- Confirmed Pose Quality Audit gate at `TestingPanel.tsx:138` fires when
  `aggregateScore === 0` OR ≥60% of metrics flagged on confidence.
- Confirmed Claude SKIPPED banner at `TestingPanel.tsx:1047-1063` reads
  `result.log_data.claude_api.status === "SKIPPED"` and the
  `skipped_reason` string.
- Confirmed Athlete Lab refresh wiring (`AthleteLab.tsx:13/46/103-112`)
  and node `updated_at` resync — Phase 1 G/F.
- The `AnalysisLogData` type (`types.ts:260-309`) does **not** include
  `scoring_config_applied` or `distance_variance_calculated`. Section
  6.1 #1 / #4 require extending the type and the edge-function payload.
