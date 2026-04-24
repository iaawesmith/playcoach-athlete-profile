
# Group A — Execution Plan (already approved, switching to build mode)

All four fixes pre-approved in the prior turn. Pre-execution recon already completed: confirmed the analyzer's bilateral-resolution branch already supports `'none'` at runtime (lines 2800–2816 of `analyze-athlete-video/index.ts`), so A2 is a pure type-side fix — no edge function change needed.

## Files touched (4 files, 6 surgical edits)

### A1 — `supabase/functions/analyze-athlete-video/index.ts`

**Edit 1 — SELECT statement (lines 860–869).** Add `position`, `confidence_handling`, `min_metrics_threshold`.

```diff
     .select(`
-      id, name, status, node_version,
+      id, name, position, status, node_version,
       clip_duration_min, clip_duration_max,
       solution_class, performance_mode, det_frequency,
       det_frequency_solo, det_frequency_defender, det_frequency_multiple,
       tracking_enabled, segmentation_method,
       llm_prompt_template, llm_system_instructions,
       llm_tone, llm_max_words,
-      scoring_rules, score_bands, scoring_renormalize_on_skip,
+      scoring_rules, score_bands, scoring_renormalize_on_skip,
+      confidence_handling, min_metrics_threshold,
       camera_guidelines,
```

**Edit 2 — Scoring config reads + new observability log (lines 2888–2909).**

```diff
-  const confidenceHandling = nodeConfig.scoring_rules?.confidence_handling || 'skip'
+  const confidenceHandling = nodeConfig.confidence_handling || 'skip'
   const renormalize = nodeConfig.scoring_renormalize_on_skip !== false
   ...
-  const minThreshold = nodeConfig.scoring_rules?.min_metrics_threshold || 50
+  const minThreshold = nodeConfig.min_metrics_threshold ?? 50
+
+  logInfo('scoring_config_applied', {
+    nodeId: nodeConfig.id,
+    nodeName: nodeConfig.name,
+    confidence_handling: confidenceHandling,
+    min_metrics_threshold: minThreshold,
+    renormalize_on_skip: renormalize,
+    total_metrics: totalMetrics,
+    scored_count: scored.length,
+    flagged_count: flagged.length,
+    skipped_count: skipped.length,
+  })
```

### A4 — same file, variables object (lines 3013–3015)

```diff
     athlete_name: context.athlete_name || 'Athlete',
     node_name: nodeConfig.name,
+    position: nodeConfig.position || '',
     athlete_level: context.athlete_level || 'high_school',
```

### A2 — `src/features/athlete-lab/types.ts` (lines 2 & 4)

```diff
-export type BilateralMode = "auto" | "left" | "right";
+export type BilateralMode = "auto" | "left" | "right" | "none";

-export type BilateralOverride = "auto" | "force_left" | "force_right";
+export type BilateralOverride = "auto" | "force_left" | "force_right" | "none";
```

### A2 — `src/features/athlete-lab/components/KeyMetricsEditor.tsx` (lines 44–54)

Add `"none"` to both option lists:

```diff
 const BILATERAL_OPTIONS: ... = [
   { value: "auto", label: "Node Default (Auto)" },
   { value: "left", label: "Node Default (Left)" },
   { value: "right", label: "Node Default (Right)" },
+  { value: "none", label: "Not bilateral (center / both-sides keypoints)" },
 ];

 const BILATERAL_OVERRIDE_OPTIONS: ... = [
   ...existing three...
+  { value: "none", label: "Not bilateral",
+    description: "Use the metric's keypoint indices verbatim. No mirroring, no side selection. Use for center keypoints (nose, hip-center) or metrics that intentionally span both sides (e.g. hip width, ankle stance width)." },
 ];
```

### A3 — `src/features/athlete-lab/components/CameraEditor.tsx` (lines 64–72)

Replace BODY_PART_GROUPS with MediaPipe Pose 33-landmark mapping (decomposed arms, single-model note):

```diff
-const BODY_PART_GROUPS: BodyPartGroup[] = [
-  { label: "Head and Face", ..., indexRange: [0, 4] },
-  { label: "Shoulders and Arms", ..., indexRange: [5, 10] },
-  { label: "Hips", ..., indexRange: [11, 12] },
-  { label: "Knees", ..., indexRange: [13, 14] },
-  { label: "Ankles", ..., indexRange: [15, 16] },
-  { label: "Feet (Heel/Toe)", ..., indexRange: [17, 22], requiresModel: "Body with Feet" },
-  { label: "Hands", ..., indexRange: [91, 132], requiresModel: "Wholebody" },
-];
+// MediaPipe Pose 33-landmark map. All landmarks come from one model;
+// `requiresModel` retained on the interface for forward compat (HandLandmarker).
+const BODY_PART_GROUPS: BodyPartGroup[] = [
+  { label: "Face", humanLabel: "Head must be clearly visible and facing camera", indexRange: [0, 10] },
+  { label: "Shoulders", humanLabel: "Both shoulders visible", indexRange: [11, 12] },
+  { label: "Elbows", humanLabel: "Both elbows clearly visible", indexRange: [13, 14] },
+  { label: "Wrists", humanLabel: "Both wrists clearly visible at catch point", indexRange: [15, 16] },
+  { label: "Hands (approximation)", humanLabel: "Pinky / index / thumb landmarks from MediaPipe Pose. Approximation only — for precise finger tracking, future versions can layer in MediaPipe HandLandmarker.", indexRange: [17, 22] },
+  { label: "Hips", humanLabel: "Full hip width visible", indexRange: [23, 24] },
+  { label: "Knees", humanLabel: "Both knees clearly visible", indexRange: [25, 26] },
+  { label: "Ankles", humanLabel: "Both ankles clearly visible", indexRange: [27, 28] },
+  { label: "Feet (heel + toe)", humanLabel: "Plant foot heel and toe clearly visible — required for break-foot timing and stance width", indexRange: [29, 32] },
+];
```

## Post-execution

1. Run `bun run build` and report TS + build status.
2. Report GOOD / PARTIAL / BAD with full diffs.
3. Provide sample log structures for `scoring_config_applied` and `variables_injected[].position`.
4. Present Group B plan.

## A2 confirmation (per your "pause if non-trivial" guard)

I re-grepped the analyzer before acting. The runtime side-resolution code at `analyze-athlete-video/index.ts:2800–2816` **already handles** `bilateral === 'none'` and `bilateral_override === 'none'` with a clean early-return that uses `baseIndices` verbatim. The frontend types are simply lagging — the analyzer was built expecting `'none'` to exist. **Zero edge function code change required for A2.** Type-only fix on the frontend. Proceeding without pause.
