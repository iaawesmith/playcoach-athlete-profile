# Athlete Lab Architecture Audit

**Date:** 2026-04-25
**Author:** Audit conducted by Claude in collaboration with EJS
**Scope:** All admin tabs of the Athlete Lab node configuration interface
**Frame:** Unbiased re-evaluation of every field, input, and architectural decision in light of the MediaPipe migration. The Athlete Lab was built for an MMPose pipeline that needed body-proportion priors, fragile manual configuration, and complex calibration math. We migrated to MediaPipe but never re-asked whether the admin surface should still look the same. This audit asks that question for every tab.

---

## Methodology and biases I'm pushing against

Three priors I'm actively challenging in this audit:

1. **"It's already built so it must be needed."** Sunk cost reasoning. Many fields are MMPose-era cruft.
2. **"More configuration is better."** Admin surfaces full of fields that admins must fill correctly are fragile. MediaPipe enables more inferred behavior, less admin burden.
3. **"Phase 1 work means the structure is settled."** Phase 1 was correctness work on metric scoring, not architectural validation. We never re-asked whether the architecture itself was right.

For each tab I evaluate four questions:

- **What it does today** — what content it stores, where that content flows
- **Why it exists** — what problem it was solving, often MMPose-era
- **What MediaPipe changes** — does the new pipeline make this unnecessary, redundant, or wrong
- **Rebuild recommendation** — if rebuilding from scratch today, what would I do

Findings are tagged:
- **KEEP** — useful, well-architected, retain as-is
- **MODIFY** — useful but needs restructuring
- **DEPRECATE** — actively harmful or pure cruft, remove
- **MISSING** — should exist but doesn't

---

## Tab 1: Basics

### What it does today

Stores top-level node identity:
- Node Name (e.g., "Slant")
- Position (e.g., "WR") — added after Slant was created, not editable from Basics today
- Clip Duration min/max (e.g., 3-4 seconds)
- Status (Live, Draft, Archived)
- Node Version
- Icon URL
- Description / Overview text

### Why it exists

Identity layer for the node. Most fields are unambiguous and necessary. This tab is the closest thing the system has to a "settings" page rather than an architectural decision surface.

### What MediaPipe changes

Nothing meaningful. MediaPipe is a pose detection model, not a node identity system. Basics tab content is orthogonal to which pose model runs.

### Field-by-field analysis

**Node Name:** KEEP. Identity field, unambiguously needed.

**Position:** MODIFY. Position is critical for Claude prompt context (Lovable trace confirmed `{{position}}` substitution into the LLM prompt). But the field is set at node creation and not editable from Basics afterward. The Slant node has `position: null` because it was created before this field existed, and there's no UI to fix it post-creation.

The field is needed. The UI surface for editing it is missing.

**Clip Duration min/max:** KEEP. Pre-flight validation uses these to reject uploads that don't fit the expected window. Necessary.

**Status (Live/Draft/Archived):** KEEP. Controls whether the node appears in athlete-facing surfaces and whether test runs are accepted. Standard CMS pattern.

**Node Version:** KEEP. Useful for change tracking. Currently bumps on each edit.

**Icon URL:** KEEP. Athlete-facing visual identity.

**Description / Overview:** MODIFY. The text is athlete-facing but currently doesn't reach Claude. Could be split into two purposes: athlete-facing intro text (stays in Basics) and admin-internal description (move to a different tab or remove). Today it tries to do both jobs and does neither well. Slant's description still references "break angle" instead of "Plant Leg Extension" — copy drift because there's no clear home for where the canonical description lives.

### Knowledge Base accuracy

Basics tab Knowledge Base content (if present) was not visible in our session. Not auditable here.

### Rebuild recommendation

**Tab structure is fundamentally correct.** Two changes:

1. **Add Position field as editable.** Dropdown: WR, RB, QB, OL, DL, LB, DB, S, K, P. Persist to existing `athlete_lab_nodes.position` column. Update Slant's value to "WR" once shipped.

2. **Clarify Description field intent.** Either rename to "Athlete-facing description" and explicitly scope it to that purpose, OR add a separate "Admin notes" field for internal context. Currently the field tries to be both and copy drifts.

3. **Decide whether Description should reach Claude.** If yes, wire `{{node_description}}` into the LLM Prompt template. If no, document explicitly that Description is athlete-UI-only.

### Verdict: KEEP, MODIFY position field UI

---

## Tab 2: Videos

### What it does today

Stores reference videos for the node:
- Video URL (typically YouTube)
- Clip window (start/end seconds within source video)
- Camera Angle (Sideline, End Zone, etc.)
- Type (Educational, Reference, Both)
- Reference flag (Yes/No)

For Slant, today: 1 video — "ROUTE RUNNING TEACH TAPE - SLANT" YouTube clip from 6s-11s, sideline camera, Type=Educational, Reference=Yes.

### Why it exists

Reference videos serve two functions:

1. **Educational content** for athletes before they film their own attempt — a teach tape or example
2. **Reference benchmark** displayed alongside athlete results — "here's what good looks like"

### What MediaPipe changes

Nothing technical. Reference videos aren't fed into the pose detection pipeline. They're athlete-facing display content.

What MediaPipe enables that this tab doesn't yet leverage: **pose-traced reference videos**. MediaPipe could analyze the reference video itself, extract the elite pose trajectory, and overlay athlete-vs-reference comparison. Today reference is just a video link.

### Field-by-field analysis

**Video URL:** KEEP. Necessary for reference video functionality.

**Clip Window (start/end seconds):** KEEP. Allows extracting a specific portion of a longer source video.

**Camera Angle:** MODIFY. Currently a metadata field with no enforcement. If athlete films from end zone but reference is sideline, comparison is meaningless. Should be tied more tightly to athlete upload context — "this reference video is for sideline-filmed attempts only."

**Type (Educational/Reference/Both):** DEPRECATE in favor of Reference flag alone. The Type field and the Reference Yes/No flag overlap confusingly. Knowledge Base says "Use Both when a video serves both purposes" — but that means Type and Reference are not orthogonal axes, they're two ways of saying the same thing. Either:
- Keep Type and remove Reference flag, OR
- Keep Reference flag (Yes/No) and remove Type

The second is simpler. A video either is reference content or isn't. Type adds no information.

**Reference flag:** KEEP if Type is removed. Otherwise consolidate.

### Knowledge Base accuracy

The tab's KB documentation describes Type and Reference as having distinct purposes. In practice they overlap and create configuration ambiguity (the Slant config has Type=Educational AND Reference=Yes simultaneously, which the documentation doesn't clearly resolve).

### Missing functionality

**Pose-traced reference comparison.** MediaPipe could analyze the reference video, extract elite phase markers and metric values, and display them alongside athlete results. "Your Plant Leg Extension was 103°, the reference's was 142° — here's the visual comparison." This is a Phase 4+ feature but the architecture doesn't currently store or surface reference-derived data.

### Rebuild recommendation

1. **Consolidate Type + Reference into a single field.** "This video is: Educational only / Reference only / Both." One field, three options. Knowledge Base aligns.

2. **Add Camera Angle enforcement.** When athlete uploads, match athlete's camera angle to a reference video with the same angle. If no matching angle exists, warn admin during node configuration that the reference set is incomplete.

3. **Phase 4+: Add pose-extracted reference data.** Run MediaPipe on reference videos at upload time, store elite pose trajectory + metric values, surface as "compare to elite" overlay in athlete results.

### Verdict: MODIFY (consolidate Type/Reference, tighten Camera Angle binding)

---

## Tab 3: Mechanics

### What it does today

Stores phase-by-phase coaching prose. For Slant: 5 sections (Release, Stem, Break, Catch Window, YAC) with 5-7 sentences each of coaching language describing what the athlete should do during each phase.

Each section also displays an auto-generated summary of which metrics are scored in that phase ("Metrics measured here: Plant Leg Extension, Hip Stability — 65% of total score").

### Why it exists

The original intent (per the tab's Knowledge Base documentation) was: provide coaching cues that flow into the Claude API prompt to give the LLM domain-specific coaching language to ground its feedback in.

### What MediaPipe changes

Nothing about MediaPipe makes this tab necessary or unnecessary. The tab's purpose is to feed Claude with coaching context, which is independent of the pose model.

### What Lovable's empirical trace proved

`pro_mechanics` is read **zero times** in the edge function. The Mechanics tab content has never reached Claude in any analysis run. The Knowledge Base documentation claiming the content flows to Claude is **factually wrong**.

Additionally: the admin (you) has been duplicating the same coaching cues into both `pro_mechanics[].content` AND the lower half of `phase_breakdown[].description` under a `— Coaching cues —` separator. Same content stored in two locations. Neither location reaches Claude.

### Field-by-field analysis

**Phase coaching cues (the prose itself):** Content is high-quality and would be valuable IF it reached Claude. Currently dead weight in the pipeline.

**Auto-generated "Metrics measured here" summary:** Buggy. Includes inactive metrics in phase weight totals (Slant Mechanics tab claims Break = 80% of score including inactive Head Snap Timing; actual active Break weight is 65%). Confuses admins about what the system actually scores.

### Knowledge Base accuracy

**Documentation is wrong.** Knowledge Base says Mechanics content flows to Claude. Empirical trace proves it doesn't. This is the most concrete example of architectural drift in the entire Athlete Lab — documentation describes intended behavior that was never implemented or was removed.

### Rebuild recommendation

This is the strongest deprecation candidate in the Athlete Lab. Three options:

**Option A (recommended): Deprecate Mechanics tab, migrate coaching cues into Phases tab.**

Phases tab already has a `description` field per phase. Add a second field per phase: `coaching_cues`. The `description` field describes what the phase IS biomechanically (1-3 sentences). The `coaching_cues` field describes what the athlete should DO (5-7 sentences). Both fields wire into Claude prompt context as part of Phase 1c work.

Mechanics tab disappears. Content lives where it logically belongs (with the phase definition, not in a separate tab).

**Option B: Keep Mechanics tab but actually wire its content to Claude.**

Less clean architecturally. Two tabs (Phases and Mechanics) both describing aspects of phases — confusing surface for admins. Maintains the duplication pattern.

**Option C: Keep tab, remove auto-summary feature only.**

Solves the immediate "metrics measured here" bug but leaves Mechanics content still not flowing to Claude. Half-measure.

Option A is the clean answer. Tab deprecation as part of Phase 1c.

### Verdict: DEPRECATE (consolidate into Phases tab)

---

## Tab 4: Phases

### What it does today

Stores movement segmentation:
- Phase name (e.g., "Break")
- Phase order (1-5)
- Frame window detection rules (start/end percentages of clip duration)
- Phase weight (proportion of overall score, e.g., Break = 65%)
- Phase description text

Slant has 5 phases: Release, Stem, Break, Catch Window, YAC.

### Why it exists

Two architectural purposes:

1. **Tells metrics WHEN to measure.** Plant Leg Extension only makes sense during the Break phase. Without phases, metrics would average across irrelevant frames.

2. **Aggregates metrics into phase scores.** "Break: 56/100" is more useful coaching feedback than four individual metric scores in isolation.

### What MediaPipe changes

MediaPipe doesn't change why phases are needed. Pose detection produces pose data per frame; something has to decide which frames matter for which metric. Phases serve that role regardless of pose model.

What MediaPipe could enable: **automatic phase detection** from pose data. Today phase frame windows are configured manually (e.g., "Release = 0%-19% of clip"). MediaPipe's full-body landmarks could be used to auto-detect transitions (e.g., "athlete plants foot at frame 32, that's the Break entry") rather than requiring fixed percentage windows.

### Field-by-field analysis

**Phase name:** KEEP. Used in phase score formatting and (when Phase 1c ships) in coaching prompts.

**Phase order:** KEEP. Determines display order and scoring sequence.

**Frame window (start/end percentages):** MODIFY. Today this is configured per phase as fixed percentage of clip duration. For a 3-second clip, Release = 0-15 frames. This is fragile — different athletes have different phase timings. A faster athlete completes the Release phase in 0.4 seconds; a slower one takes 0.7 seconds. Fixed windows produce mismatch.

MediaPipe could enable **dynamic phase detection** based on pose features (foot plant, hip rotation, hand position). This is Phase 5+ work but the rebuild target should be dynamic, not fixed.

**Phase weight:** KEEP. Necessary for aggregate score computation.

**Phase description:** MODIFY. Currently being used as a dual-purpose field (description + coaching cues with `— Coaching cues —` separator). If Mechanics tab deprecates into Phases, split this into two clear fields: `description` (biomechanical, 1-3 sentences) and `coaching_cues` (athlete-facing, 5-7 sentences). Wire both to Claude prompt context.

### Knowledge Base accuracy

Phases tab documentation correctly states phase frame windows drive metric measurement. Documentation aligns with actual behavior. KB accuracy: GOOD.

### Missing functionality

**Phase context not reaching Claude.** Phase descriptions and coaching cues exist but aren't injected into the LLM prompt. Claude receives only phase NAMES (formatted into score line) but no descriptions. This is documented in Lovable's claude-prompt-content-trace.md and is Phase 1c work.

**Dynamic phase detection.** Phase frame windows are static percentages. Should be derived from pose features for accuracy.

### Rebuild recommendation

1. **Keep Phases tab as separate from Metrics tab.** The phase/metric separation is one of the strongest architectural choices in PlayCoach — it enables reuse across nodes (every route has Release/Stem/Break/Catch/YAC structure), independent configuration of measurement vs. structure, and modular scoring aggregation.

2. **Split phase description into `description` + `coaching_cues` fields.** Wire both to Claude prompt as part of Phase 1c.

3. **Migrate Mechanics tab content here.** When Mechanics deprecates, its phase coaching cues land in this tab's new `coaching_cues` field per phase.

4. **Phase 5+: Add dynamic phase detection.** Replace fixed frame window percentages with pose-feature-based detection. "Break phase starts when plant foot makes ground contact" rather than "Break phase = frames 30-45."

5. **Wire phase descriptions and coaching cues into Claude prompt.** New template variables: `{{phase_context}}` injecting per-phase description + cues, formatted to give Claude phase-aware coaching language.

### Verdict: KEEP (with significant Phase 1c upgrades)

---

## Tab 5: Metrics

### What it does today

Stores the actual measurements the system computes:
- Metric name (e.g., "Plant Leg Extension")
- Phase assignment (which phase the metric measures during)
- Calculation type (angle, distance, distance_variance, velocity)
- Keypoint indices (which MediaPipe landmarks to read)
- Elite target value (e.g., 140°)
- Tolerance (e.g., ±15°)
- Weight (within phase, e.g., 50%)
- Internal documentation
- Active/inactive flag
- Bilateral mode (for symmetric metrics)
- Direction-aware flag

Slant has 6 metrics defined, 4 active: Plant Leg Extension, Hip Stability, Release Speed, Hands Extension at Catch.

### Why it exists

This is the core of the analysis system. Metrics are what get measured, scored, and reported. Without metrics there's no analysis.

### What MediaPipe changes

This is where MediaPipe vs MMPose differences matter most. Three specific impacts:

1. **MediaPipe returns 33 landmarks; MMPose returned 17 (or 133 in WholeBody).** All keypoint indices need to be MediaPipe-correct. Phase 1 caught this in some places but Lovable's first-test diagnostic found `calculateBodyBasedCalibration` was still using COCO-17 indices [5,6,11,12] — which we patched.

2. **MediaPipe provides world-coordinate landmarks (3D in meters).** Currently the pipeline uses 2D screen coordinates for distance metrics, requiring pixels-per-yard calibration. Phase 3+ could use world coordinates directly, eliminating calibration entirely.

3. **MediaPipe has higher per-frame accuracy than MMPose.** Some scoring tolerance values may be too lenient for MediaPipe-quality data. Phase 1 didn't recalibrate elite targets for MediaPipe accuracy.

### Field-by-field analysis

**Metric name:** KEEP. Identity field.

**Phase assignment:** KEEP. Necessary for measurement window.

**Calculation type (angle, distance, distance_variance, velocity):** KEEP, but each type has issues:
- `angle`: clean, no calibration dependency. Working correctly.
- `distance`: calibration-dependent, currently affected by ppy=200 issue.
- `distance_variance`: new in Phase 1 (Hip Stability), working but UI sub-card not rendering due to `calculation_type` not flattened onto persisted result.
- `velocity`: structurally fragile per Lovable's release-speed investigation. Single-sample lottery. Phase 1c fix in progress.

**Keypoint indices:** KEEP, but needs validation. After Phase 1 patch corrected the calibration indices, all metric keypoint indices should be MediaPipe-correct. Worth a one-time audit to confirm no other COCO-17 holdovers exist.

**Elite target value:** KEEP. The number to compare against.

**Tolerance:** KEEP. Defines the scoring curve.

**Weight:** KEEP. Necessary for phase score aggregation.

**Internal documentation (added in Phase 1):** KEEP. Phase 1 invested in this for good reason — it's the canonical place to capture what each metric actually measures, why the target is what it is, and known limitations. High-value field.

**Active/inactive flag (added in Phase 1):** KEEP. Allows soft-deleting metrics without losing config history.

**Bilateral mode:** MODIFY. Currently has options "left", "right", "average", "none". Needed for some metrics (e.g., a symmetric metric averaging left and right). Confusingly applied today — Plant Leg Extension uses indices 23, 25, 27 which are one-sided (left), but Bilateral Mode is set to "none" instead of "left." Field works but is fragile and admin-error-prone.

Better approach: derive bilateral mode from keypoint indices (if both 23,24 are listed, infer bilateral; if only 23, infer left). Reduces admin burden.

**Direction-aware flag:** MODIFY. Adjusts for athletes breaking left vs right. Necessary for slant routes (athlete breaks one way or the other) but currently a binary flag with limited semantics. Could be richer (specifying which keypoints flip when direction reverses).

### Knowledge Base accuracy

Metrics tab Knowledge Base content was extensively reviewed in Phase 1. Accurate where checked. The tab is the most-accurate Knowledge Base content in the Athlete Lab.

### Missing functionality

**Metric-level scoring curve choice.** Today every metric uses linear deviation from target. Different metrics may benefit from different curves (sigmoid for binary-ish metrics, asymmetric for metrics where overshoot is worse than undershoot). No way to express this today.

**Plausibility bounds.** When calibration produces impossible values (Release Speed 158 mph), the metric scores 0 instead of flagging as "measurement error, please re-film." Today's implementation conflates "athlete failed at the metric" with "data is bad." Should be separable.

**MediaPipe landmark name labels.** Keypoint indices today are stored as integers (23, 25, 27). Admin has to know what those mean. The system should display "Hip (left), Knee (left), Ankle (left)" alongside the integer indices. The keypointLibrary.json file exists for this lookup but isn't surfaced in admin UI.

### Rebuild recommendation

1. **Audit all keypoint indices for MediaPipe correctness.** One-time review to confirm no other COCO-17 holdovers. Lovable can do this in 30 minutes.

2. **Add MediaPipe landmark name display to admin UI.** When admin selects keypoints, show "Hip Left (23), Knee Left (25), Ankle Left (27)" rather than just "23, 25, 27."

3. **Add plausibility bounds per metric.** For each metric, allow admin to specify "if measured value is outside [min, max], flag as measurement error rather than scoring." Release Speed > 25mph: flag, don't score. Hands Extension > 1.5yd: flag, don't score.

4. **Add scoring curve choice per metric.** Linear deviation, sigmoid, asymmetric. Default to linear.

5. **Simplify Bilateral Mode by inferring from keypoint indices.** Reduce admin error surface.

6. **Phase 3+: Migrate distance/velocity metrics to MediaPipe world coordinates.** Eliminates calibration entirely for these metric types.

### Verdict: KEEP (with significant additions for plausibility bounds, scoring curves, landmark naming)

---

## Tab 6: Errors

### What it does today

Stores common errors the system can detect:
- Error name (e.g., "Rounding the break")
- Auto-detectable flag (Yes/No)
- Detection condition (e.g., "Plant Leg Extension < 125")
- Description of the error

Today's Slant has 5 errors defined: Rounding the break, Tipping the route with eyes, Slowing down before the break, Body catch, Drifting after the catch.

Of these, 2 are auto-detectable from metric values. 3 are flagged "Auto-detectable: No" but show as "TRIGGERED" in the log anyway, which is confusing.

### Why it exists

Two intended purposes:

1. **Auto-detect specific failure modes** from metric values and surface them as named errors rather than just low scores.

2. **Provide error names to Claude** so coaching feedback can reference specific error patterns ("you rounded the break") rather than just metric values.

### What MediaPipe changes

Nothing structural. Errors are derived from metric values; metrics depend on pose data; pose data comes from MediaPipe. The error layer is downstream of the model choice.

### Field-by-field analysis

**Error name:** KEEP. Identity, used in detection output.

**Auto-detectable flag:** CONFUSING. Today, errors marked "Auto-detectable: No" still show as TRIGGERED in the log if they have a condition. The flag's meaning is unclear — if a condition exists, the system evaluates it regardless of the flag. The flag may be intended to mark errors that REQUIRE human review even when conditions trigger, but that's not how it's currently rendered.

**Detection condition:** MODIFY. Conditions are stored as free text strings ("Plant Leg Extension < 125"). They're parsed somewhere to evaluate against metric results. This is fragile — typos in metric names silently break detection. Should be a structured field with metric dropdown + comparison operator + threshold value.

**Description:** KEEP if reaches Claude, deprecate if doesn't. Need to verify whether error descriptions reach Claude (Lovable's claude-prompt-content-trace shows `{{detected_errors}}` template variable receives error names but does it include descriptions? Worth checking.)

### Knowledge Base accuracy

Tab documentation should explain the Auto-detectable flag's meaning. Currently unclear. KB likely needs update.

### Missing functionality

**Errors that depend on multiple metrics simultaneously.** Today conditions reference one metric at a time. Some real errors are combinations ("Plant Leg < 125 AND Hip Stability > 0.1 = Sitting and falling out of break"). No way to express this.

**Error severity levels.** All errors are equal weight today. Some errors are catastrophic (route-ending), some are minor (suboptimal but not failure). No severity distinction.

**Error categories for coaching prioritization.** A coach would prioritize fixing one error over another. The system has no way to express priority — Claude has to infer from metric weights.

### Rebuild recommendation

1. **Clarify or remove Auto-detectable flag.** If the field has meaning, document it and enforce it in rendering. If not, remove it.

2. **Make detection conditions structured.** Dropdown for metric + operator + threshold. No free-text parsing.

3. **Verify error descriptions reach Claude.** If they do, keep them. If they don't, either wire them in (Phase 1c) or remove them.

4. **Add error severity field.** Low/Medium/High. Inform Claude prompt about which errors to prioritize.

5. **Phase 4+: Multi-metric error conditions.** Allow conditions like "metric A < X AND metric B > Y."

### Verdict: MODIFY (clarify Auto-detectable, structure conditions, verify Claude wiring)

---

## Tab 7: LLM Prompt

### What it does today

Stores the Claude API call configuration:
- System instructions (the persona/behavior prompt sent as `system` parameter)
- Prompt template (the user message template with `{{variable}}` substitutions)
- Max words target
- Tone settings (currently a `llm_tone` field, dead per earlier audit)

For Slant, the system instructions include athlete-level adaptation logic (`{{athlete_level}}`) and focus area handling (`{{focus_area}}`).

### Why it exists

This is where the Claude API call is configured. Critical surface — controls every coaching feedback Claude generates.

### What MediaPipe changes

Nothing about MediaPipe affects this tab directly. But MediaPipe's improved data quality enables more sophisticated prompts (more confident assertions about what happened, more specific coaching language). Today's prompt templates are conservative because data quality was uncertain under MMPose.

### What Lovable's empirical trace proved

Several issues:

1. **System parameter doesn't run variable substitution.** Template variables `{{athlete_level}}`, `{{focus_area}}`, `{{skipped_metrics}}` appear in `llm_system_instructions` but the substitution loop only runs against the user prompt. Claude receives literal `{{athlete_level}}` strings inside system instructions. Athlete-level adaptation is broken.

2. **Multiple admin-config fields don't reach Claude despite documentation suggesting they do.** Mechanics content, phase descriptions, scoring rules text, error descriptions — variable amounts of content are stored in admin tabs but never substituted into Claude's prompt.

3. **Position field works correctly when populated.** Today's test confirmed `{{position}}` reaches Claude as "WR" when the field is set.

### Field-by-field analysis

**System instructions:** KEEP, but FIX. Variable substitution must run against system parameter, not just user prompt.

**Prompt template:** MODIFY. Currently has limited template variables. Should expand to include phase descriptions, phase coaching cues, error descriptions, and any other admin-config content that should inform Claude's response.

**Max words:** KEEP. Useful constraint.

**llm_tone field:** DEPRECATE. Lovable's earlier trace flagged this as unused.

### Knowledge Base accuracy

LLM Prompt tab documentation may describe template variables. Without seeing the KB content directly, I can't audit it precisely. Worth checking for accuracy when reviewing.

### Missing functionality

**Prompt versioning.** No way to A/B test prompts or roll back if a new prompt produces worse coaching. Each prompt edit overwrites the previous.

**Per-phase coaching cue injection.** Phases tab has coaching cues (or will, post-Mechanics-deprecation), but no template variable currently exists to inject them into the prompt.

**Error description injection.** Errors tab has descriptions, but only error names reach Claude today.

**Output format constraints beyond word count.** No way to enforce structure (e.g., "Must include: lead, drill, cue").

### Rebuild recommendation

1. **Fix system parameter variable substitution.** Run substitution loop against system AND user prompt. Phase 1c work, identified as P0.

2. **Expand template variable set.** Add `{{phase_context}}`, `{{error_descriptions}}`, `{{node_overview}}`, others as Phase 1c determines what should reach Claude.

3. **Document which admin fields reach Claude.** A reference table in the LLM Prompt tab Knowledge Base showing every field across every tab and whether it reaches Claude. Currently this is opaque to admins.

4. **Remove dead fields.** `llm_tone` and any other unused fields.

5. **Phase 4+: Add prompt versioning.** Track prompt history, enable A/B testing.

### Verdict: MODIFY (fix system substitution, expand template variables, remove dead fields)

---

## Tab 8: Reference

### What it does today

Stores calibration data:
- Per camera angle: pixels-per-yard reference value
- Reference object specifications (if used for calibration)
- Calibration confidence settings

For Slant: Sideline = 80 pixels per yard.

### Why it exists

The pipeline needs to convert pixel measurements (from pose detection) to real-world distances (yards). Reference calibration provides this conversion when dynamic calibration isn't available.

### What MediaPipe changes

This is the most architecturally affected tab by the MediaPipe migration. Three impacts:

1. **MediaPipe provides world coordinates (3D in meters) directly.** For metrics using world coordinates, calibration is unnecessary. The Reference tab becomes obsolete for those metrics.

2. **MediaPipe's body-based calibration is more reliable than MMPose's was.** With Patch 1 fixed, the system computes ppy from observed shoulder/hip pixel widths against expected anthropometric proportions. This works without needing reference calibration at all.

3. **MediaPipe enables future line-pair dynamic calibration.** Could detect field markings (yard lines, hash marks) automatically and compute ppy from real ground-truth references in the video itself. Makes manual reference calibration obsolete.

### Field-by-field analysis

**Pixels-per-yard per camera angle:** MODIFY or DEPRECATE. Today this is used as a fallback when body-based calibration fails. Lovable's calibration source trace showed:
- Dynamic calibration (line-pair) doesn't exist yet
- Body-based calibration (now patched) drives metrics in practice
- Static reference is rarely the source actually used

If body-based calibration is the primary source going forward, static reference becomes a rarely-needed fallback. Worth keeping but not the primary calibration path.

**Reference object specifications:** Likely DEPRECATE. Today uses generic body proportions (shoulder = 0.518 yards, hip = 0.382 yards for a 6' athlete). This is the MMPose-era approach. If we migrate to MediaPipe world coordinates (Phase 3+), reference objects become unnecessary.

**Calibration confidence settings:** KEEP, but restructure. Current confidence gates produced confusing logged failures (e.g., "dynamic_pixels_per_yard_out_of_range" appearing in logs even when body-based was used). Cleaner gate logic per Lovable's calibration source trace recommendation.

### Knowledge Base accuracy

Reference tab Knowledge Base may describe calibration as user-configurable per camera angle. In practice, body-based calibration is the source of truth post-Patch 1. KB needs alignment with code reality.

### Missing functionality

**World-coordinate metric mode.** No setting today to indicate "this metric uses world coordinates, no calibration needed." Phase 3+ feature.

**Dynamic line-pair calibration.** Not implemented. Code paths reference it but no actual line-pair detection exists in the MediaPipe service.

### Rebuild recommendation

This tab is the strongest candidate for major architectural rework. Options:

**Option A (recommended for Phase 1c): Simplify static reference, retain as fallback.**

Keep per-camera-angle ppy values as a safety fallback. Document that body-based calibration is the primary source. Remove the dead "dynamic" gate logic that creates log noise. Static reference becomes rarely-used safety net.

**Option B (Phase 3+): Migrate to MediaPipe world coordinates entirely.**

For all distance/velocity metrics, use MediaPipe's world coordinate output directly. Calibration becomes irrelevant. Reference tab deprecates entirely. Athlete uploads no longer need pixel-to-yard conversion at all.

**Option C: Build line-pair dynamic calibration.**

Extract field markings from video, compute ppy from detected line pairs. Replaces both static reference and body-based calibration. Most accurate but most expensive to build.

A is the Phase 1c minimum. B is the right long-term answer. C is Phase 5+.

### Verdict: DEPRECATE most, KEEP simplified fallback

---

## What's missing entirely

Beyond the per-tab analysis, several capabilities don't exist anywhere in the Athlete Lab today:

### 1. Pipeline observability dashboard

Lovable's diagnostic work has been excellent at empirically tracing what reaches Claude, what's stored vs. used, and where bugs hide. But this is investigative work each time. A persistent observability dashboard would show:
- For the most recent N runs: which calibration source drove metrics
- Which template variables had non-empty substitutions
- Which admin-config fields reached the LLM
- Distribution of metric values across runs (catches outliers, drifts)

This would prevent the kind of architectural drift this audit is trying to address. If the dashboard had existed, the COCO-17 calibration index bug would have surfaced as "shoulderWidthPixels: 4.34" being flagged against a "expected 60-150" range automatically.

### 2. Test fixture library

No way to save a "known good" test upload as a fixture for regression testing. Each diagnostic test consumes admin time. A fixture library would let Lovable verify patches against pre-recorded known cases.

### 3. Athlete-level field surface

The system has athlete_level (Youth/HS/College/Pro) flowing through context. But where the athlete-level differences manifest in coaching feedback is buried in the system prompt. No admin surface to configure "for Youth athletes, soften this language" or "for College athletes, use technical terms freely."

### 4. Reference video pose extraction

As noted in Videos tab analysis, reference videos could have their pose data extracted and stored as elite trajectories for comparison. Today reference videos are just video links.

### 5. A/B prompt testing

Edits to prompts overwrite previous versions. No way to test new prompts against old prompts on the same fixture data.

### 6. Admin error surface

When admin configures something incorrectly (wrong keypoint index, dead field, conflicting values), the system silently produces wrong results. There's no validation surface saying "this configuration won't work" before the test runs.

---

## Architectural drift summary

Across the audit, several patterns emerged:

### Pattern 1: Documentation describes intended behavior, code does something else

Most concrete examples:
- Mechanics tab KB: "Content reaches Claude" — empirically false
- Phase tab descriptions: documented as reaching Claude — only names reach Claude
- System parameter substitution: documented as supporting all template variables — only user prompt substitutes
- llm_tone: documented as a styling field — never read

This pattern is the strongest evidence of architectural drift. The Athlete Lab was designed with intentions that weren't fully implemented or were partially abandoned. Fixing this is partly engineering (wire the missing pieces) and partly documentation (update KB to match reality).

### Pattern 2: Fields exist for MMPose-era reasons that MediaPipe makes obsolete

Most concrete examples:
- athlete_height: needed for MMPose body-proportion priors, now drives buggy edge calibration that should be replaced
- athlete_wingspan: never read by anything, pure cruft
- Reference object specifications: MMPose-era calibration approach
- Static reference ppy: increasingly rarely used post-MediaPipe body-based fix

### Pattern 3: Auto-derived fields that get out of sync with source data

Most concrete examples:
- Mechanics tab "Metrics measured here: X — Y%" auto-summary: includes inactive metrics, miscalculates weights
- Phase weight totals shown in admin UI: don't always sum to 100% on first render

When the system auto-derives display content from source data, the derivation logic must be airtight. Currently it has gaps.

### Pattern 4: Configuration overflow

Many admin fields exist that admins don't know how to set correctly. Examples:
- Bilateral Mode: requires admin to know whether keypoints are symmetric
- Direction-aware flag: meaning unclear
- Auto-detectable flag on Errors: doesn't actually control auto-detection
- Type vs Reference on Videos: overlapping fields with unclear distinction

Each of these is a place where admin error produces wrong analysis. The MediaPipe migration enables more inferred behavior — fewer fields to set manually, more derived automatically from data.

---

## Phase 1c rebuild scope

If Phase 1c is the architectural cleanup pass following this audit, here's the recommended scope sorted by priority:

### P0 (blocks meaningful product progress)

1. **Fix system parameter variable substitution.** {{athlete_level}}, {{focus_area}}, {{skipped_metrics}} must substitute in system param, not just user prompt. Athlete-level adaptation is broken without this.

2. **Add Position field UI to Basics tab.** Already-needed change blocked by no edit surface.

3. **Wire phase descriptions and coaching cues into Claude prompt.** Add `{{phase_context}}` template variable. Edge function reads phase_breakdown[] and formats per-phase content into the prompt.

4. **Deprecate Mechanics tab.** Migrate coaching cues into Phases tab as `coaching_cues` field per phase. Phases tab becomes single source of truth for phase-level content.

### P1 (architectural cleanup)

5. **Remove athlete_wingspan field.** Pure dead code per Lovable trace.

6. **Audit and remove dead admin-config fields.** llm_tone, possibly skill_specific_filming_notes, others surfaced by trace.

7. **Restructure error detection conditions.** Replace free-text parsing with structured fields (metric dropdown + operator + threshold).

8. **Verify error descriptions reach Claude.** If yes, keep. If no, wire them in or remove.

9. **Consolidate Videos tab Type + Reference into single field.**

10. **Update all Knowledge Base content to match code reality.** Documentation/code alignment audit across all tabs.

### P2 (improvements that don't block)

11. **Add MediaPipe landmark name display in Metrics tab admin UI.**

12. **Add plausibility bounds per metric.** Distinguish "metric failed" from "data is bad."

13. **Add scoring curve choice per metric.** Linear vs sigmoid vs asymmetric.

14. **Simplify Bilateral Mode by inferring from keypoint indices.**

15. **Calibration architecture decision.** Static reference fallback vs body-based primary vs world-coordinate migration. Inform with real test data after P0 ships.

### P3 (deferred to Phase 3+)

16. **Migrate distance/velocity metrics to MediaPipe world coordinates.** Eliminates calibration entirely for those types.

17. **Dynamic phase detection from pose features.** Replaces fixed frame window percentages.

18. **Reference video pose extraction.** Compare athlete to elite at trajectory level.

19. **Pipeline observability dashboard.** Persistent visibility into config-to-Claude flow.

20. **Multi-metric error conditions.** Combinations across metrics.

---

## Final recommendations

The Athlete Lab is not broken. It's drifted. It was built well for an MMPose pipeline that no longer runs. The MediaPipe migration was completed at the model layer but not at the admin/configuration layer. Phase 1c is the architectural catch-up pass.

Three principles for Phase 1c:

1. **Documentation must match code.** Every Knowledge Base claim about how content flows, what fields do, what reaches the LLM must be empirically verified against the actual code path. If they disagree, fix one or the other.

2. **Fewer fields, more inference.** Where possible, derive admin-configurable values from data rather than requiring admin entry. Reduces error surface, leverages MediaPipe's improved data quality.

3. **One source of truth per concept.** The Mechanics tab + Phases tab both storing phase coaching cues is the canonical example of avoidable duplication. Each piece of content should live in exactly one tab, in exactly one field.

If Phase 1c follows these principles, the Athlete Lab becomes simpler, more reliable, and more honest about what it does. Today's audit suggests roughly 40% of the admin surface is candidate for simplification or removal.

That's a healthy number. Ten percent would suggest the architecture was clean. Eighty percent would suggest the architecture is fundamentally wrong. Forty percent suggests legacy cruft accumulated from a model migration that didn't trigger an admin-surface review — which is exactly what happened.

---

## What this audit didn't cover

For completeness, here's what's NOT in this audit and would need separate analysis:

- **Training tab** — you mentioned this may be misnamed; deferred to separate session
- **Athlete-facing UI** — this audit covered admin surface only
- **MediaPipe service implementation details** — covered in Lovable's diagnostic docs
- **Edge function code paths** — covered in Lovable's diagnostic docs
- **Database schema** — separate concern, follows admin surface decisions
- **Cloud Run service ops** — infrastructure, not architecture
- **Cost / latency optimization** — separate concern from correctness

End of audit.
