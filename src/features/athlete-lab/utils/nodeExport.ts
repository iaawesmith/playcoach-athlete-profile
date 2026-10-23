import { MAX_COACH_OUTPUT_TOKENS } from "../../../../supabase/functions/analyze-athlete-video/coachRequest";
import { MAX_FEEDBACK_WORDS, TARGET_FEEDBACK_WORDS } from "../../../../supabase/functions/analyze-athlete-video/prompt";
import type { TrainingNode, MechanicsSection, KeyMetric } from "../types";
import { measurementDescription, measurementFrames } from "../../../../supabase/functions/analyze-athlete-video/measurementWindow";
import { parseCameraSettings } from "../components/CameraEditor";
import { computeCategories, computeScore } from "../components/NodeReadinessBar";
import { getActiveMetrics, partitionMetricsByActive } from "./metrics";
import keypointLibrary from "@/constants/keypointLibrary.json";
import { metricSide } from "./metricSide";

// Active vs. inactive metrics: this module uses the shared helpers in
// `./metrics` (getActiveMetrics, partitionMetricsByActive) so that scoring
// math, solution-class derivation, and LLM-facing output never include
// inactive metrics. The `m.active !== false` filter is centralized there —
// do not duplicate it inline in new generators.

// Phase 1c.3-D: Consolidated tab keys (8). Per Decision H, copying a
// consolidated tab emits all merged sub-section markdown — Metrics tab
// returns metrics+scoring+errors; Reference returns reference+camera;
// Phases returns phases+checkpoints (when checkpoint-segmented); Basics
// returns basics+pipeline-config. Per-section generators below are
// preserved and combined inside generateTabMarkdown / TAB_GENERATORS.
type TabKey = "basics" | "videos" | "phases" | "metrics" | "reference" | "prompt" | "badges";
type LegacyTabKey = "mechanics" | "scoring" | "errors" | "camera" | "checkpoints" | "training_status";

const kpMap = new Map<number, string>();
for (const kp of (keypointLibrary as any).keypoints) {
  kpMap.set(kp.index, kp.name);
}

function kpName(idx: number): string {
  return kpMap.get(idx) ?? `Keypoint ${idx}`;
}

function kpNames(indices: number[]): string {
  return indices.map(i => kpName(i)).join(", ");
}

function deriveRequiredSolutionClass(maxIdx: number): string {
  // MediaPipe Pose covers all 33 landmarks (indices 0–32) with a single model,
  // so any active metric should resolve to MediaPipe Pose.
  if (maxIdx <= 32) return "MediaPipe Pose";
  // Out-of-range index — flag as unsupported so the readiness/export surfaces it.
  return "Unsupported (index > 32)";
}

function getMaxKeypointIndex(metrics: KeyMetric[]): number {
  let max = -1;
  for (const m of metrics) {
    for (const i of m.keypoint_mapping?.keypoint_indices ?? []) {
      if (i > max) max = i;
    }
  }
  return max;
}

function parseMechanics(raw: string): MechanicsSection[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function header(node: TrainingNode, tabName: string): string {
  return `# AthleteLab Node — ${tabName} Tab\n# Node: ${node.name} | Status: ${node.status === "live" ? "Live" : "Draft"}\n# Version: ${node.node_version ?? 1} | Copied: ${ts()}\n\n---\n`;
}

function generateBasics(node: TrainingNode): string {
  const overviewText = node.overview?.trim() || "Not configured";
  return `## Basics\n\nNode Name: ${node.name}\nPosition: ${node.position ?? "Not configured"}\nClip Duration: ${node.clip_duration_min}s to ${node.clip_duration_max}s\nStatus: ${node.status === "live" ? "Live" : "Draft"}\nNode Version: ${node.node_version ?? 1}\nIcon: ${node.icon_url || "not set"}\n\n### Description / Overview\n${overviewText}`;
}

function generateVideos(node: TrainingNode): string {
  const vids = node.elite_videos ?? [];
  let out = `## Videos — athlete teach tape, not analyzed (${vids.length} configured)\n`;
  if (vids.length === 0) return out + "\nNo videos configured.";
  vids.forEach((v, i) => {
    out += `\n### Video ${i + 1}: ${v.label || "Untitled"}\nURL: ${v.url}\nPlay Window: ${v.start_seconds ?? "not set"}s to ${v.end_seconds ?? "not set"}s\nReference: ${v.is_reference ? "Yes" : "No"}\n`;
  });
  return out;
}

function generateOverview(node: TrainingNode): string {
  return `## Overview\n\n${node.overview?.trim() || "Not configured"}`;
}

function generatePhases(node: TrainingNode): string {
  const phases = node.phase_breakdown ?? [];
  const weightSum = phases.reduce((s, p) => s + (p.proportion_weight ?? 0), 0);
  let out = `## Phases\n\nCount: ${phases.length} phases\nWeight Sum: ${weightSum}% ${weightSum === 100 ? "PASS" : "FAIL"}\n`;
  phases.forEach((p, i) => {
    out += `\n### Phase ${i + 1}: ${p.name} — ${p.proportion_weight ?? 0}% of clip\nFrame Buffer: ${p.frame_buffer ?? 3} frames\n`;
  });
  return out;
}

function formatMetricSummary(phaseId: string | null, metrics: KeyMetric[]): string {
  if (!phaseId) return "";
  const phaseMetrics = metrics.filter(m => m.keypoint_mapping?.phase_id === phaseId);
  if (phaseMetrics.length === 0) return "";
  const totalWeight = phaseMetrics.reduce((s, m) => s + m.weight, 0);
  let names: string;
  if (phaseMetrics.length === 1) {
    names = phaseMetrics[0].name;
  } else if (phaseMetrics.length === 2) {
    names = `${phaseMetrics[0].name} and ${phaseMetrics[1].name}`;
  } else {
    names = phaseMetrics.slice(0, -1).map(m => m.name).join(", ") + ", and " + phaseMetrics[phaseMetrics.length - 1].name;
  }
  return `Metrics measured here: ${names} — ${totalWeight}% of total score`;
}

function generateMechanics(node: TrainingNode): string {
  const sections = parseMechanics(node.pro_mechanics);
  const phases = node.phase_breakdown ?? [];
  const metrics = node.key_metrics ?? [];
  let out = `## Mechanics (${sections.length} sections)\n`;
  if (sections.length === 0) return out + "\nNo mechanics sections configured.";
  for (const sec of sections) {
    const phaseName = phases.find(p => p.id === sec.phase_id)?.name ?? "Unlinked Phase";
    out += `\n### ${phaseName}\n${sec.content || "Not configured"}\n`;
    const summary = formatMetricSummary(sec.phase_id, metrics);
    if (summary) out += `${summary}\n`;
  }
  return out;
}

function generateMetrics(node: TrainingNode): string {
  const allMetrics = node.key_metrics ?? [];
  const phases = node.phase_breakdown ?? [];
  const { active: activeMetrics, inactive: inactiveMetrics } = partitionMetricsByActive(node);

  // Active metrics drive scoring math, weight-sum validation, and the
  // solution-class derivation. Inactive metrics are rendered separately
  // below so admins can audit disabled state without those metrics
  // polluting the LLM-facing view of "what this node measures."
  const activeWeightSum = activeMetrics.reduce((s, m) => s + m.weight, 0);
  const totalWeightSum = allMetrics.reduce((s, m) => s + m.weight, 0);
  const maxIdx = getMaxKeypointIndex(activeMetrics);
  const requiredClass = maxIdx >= 0 ? deriveRequiredSolutionClass(maxIdx) : "None (no keypoints)";

  let out = `## Metrics\n\nCount: ${activeMetrics.length} active, ${inactiveMetrics.length} inactive (${allMetrics.length} total)\nActive Weight Sum: ${activeWeightSum}% ${activeWeightSum === 100 ? "PASS" : "FAIL"}\nTotal Including Inactive: ${totalWeightSum}% (informational)\nSolution Class Required: ${requiredClass} (derived from active metrics only)\n`;

  const renderMetric = (m: KeyMetric, idx: number, isActive: boolean): string => {
    const km = m.keypoint_mapping;
    const phaseName = km?.phase_id ? (phases.find(p => p.id === km.phase_id)?.name ?? "Unknown") : null;
    const phaseStatus = phaseName ? `${phaseName} ASSIGNED` : "MISSING";

    let mappingStatus = "INCOMPLETE";
    const missing: string[] = [];
    if (km) {
      if (!km.calculation_type) missing.push("calculation_type");
      if (km.keypoint_indices.length === 0) missing.push("keypoint_indices");
      if (!km.phase_id) missing.push("phase_id");
      if (missing.length === 0) mappingStatus = "COMPLETE";
    } else {
      missing.push("entire keypoint_mapping");
    }

    const internalDocs = m.internal_documentation?.trim();
    const internalDocsBlock = internalDocs
      ? `\nInternal Documentation (admin-only, not sent to LLM):\n${internalDocs}\n`
      : `\nInternal Documentation: Not configured\n`;
    return `\n### Metric ${idx + 1}: ${m.name || "Untitled"} (${m.weight}%)\nActive: ${isActive ? "Yes" : "No"}\nDescription: ${m.description?.trim() || "Not configured"}\nUnit: ${m.unit || "Not configured"}\nElite Target: ${m.eliteTarget || "Not configured"}\nTolerance: ±${m.tolerance ?? "Not configured"}\nPhase: ${phaseStatus}\nMeasurement Window (fixed): ${measurementDescription(km?.calculation_type)}\nCalculation Type: ${km?.calculation_type || "Not configured"}\nKeypoint Indices: ${km?.keypoint_indices?.join(", ") || "None"}\nKeypoint Names: ${km?.keypoint_indices?.length ? kpNames(km.keypoint_indices) : "None"}\nSide: ${metricSide(km) === "none" ? "Not bilateral" : metricSide(km)}\nConfidence Threshold: ${km?.confidence_threshold ?? 0.7}\nRequires Catch: ${m.requires_catch ? "Yes" : "No"}\nKeypoint Mapping: ${mappingStatus}${missing.length > 0 ? ` — missing: ${missing.join(", ")}` : ""}${internalDocsBlock}`;
  };

  activeMetrics.forEach((m, i) => { out += renderMetric(m, i, true); });

  if (inactiveMetrics.length > 0) {
    out += `\n### Inactive Metrics (preserved in storage, excluded from scoring)\n`;
    inactiveMetrics.forEach((m, i) => { out += renderMetric(m, i, false); });
  }

  return out;
}

function generateScoring(node: TrainingNode): string {
  const renorm = node.scoring_renormalize_on_skip ?? true;
  const catchWeight = node.key_metrics.filter(m => m.requires_catch).reduce((s, m) => s + m.weight, 0);
  let renormLine = `Renormalize on Skip: ${renorm ? "Yes" : "No"}`;
  if (!renorm) {
    renormLine += `\nMax score when catch excluded: ${100 - catchWeight}%`;
  }
  return `## Scoring\n\nLow Confidence Handling: ${node.confidence_handling ?? "skip"}\nMax skipped metrics %: ${node.min_metrics_threshold ?? 50}%\n${renormLine}`;
}

function generateErrors(node: TrainingNode): string {
  const errors = node.common_errors ?? [];
  let out = `## Errors (${errors.length} errors defined)\n`;
  if (errors.length === 0) return out + "\nNo errors defined.";
  errors.forEach((e, i) => {
    out += `\n### Error ${i + 1}: ${e.error}\nAdmin Note (not sent to coach model): ${e.correction || "Not configured"}\nAuto-Detectable: ${e.auto_detectable ? "Yes" : "No"}\nDetection Condition: ${e.auto_detection_condition || "Not configured"}\n`;
  });
  return out;
}

function generateReference(node: TrainingNode): string {
  const ANGLES: Array<{ key: string; label: string }> = [
    { key: "sideline", label: "Sideline" },
    { key: "behind_qb", label: "Behind QB" },
    { key: "endzone", label: "Endzone" },
  ];
  const cals = node.reference_calibrations ?? [];
  const calibratedCount = ANGLES.filter(a => {
    const c = cals.find(cl => cl.camera_angle === a.key);
    return c && c.pixels_per_yard && c.pixels_per_yard > 0;
  }).length;

  const camera = parseCameraSettings(node.camera_guidelines);
  // skill_specific_filming_notes is physically stored inside the
  // camera_guidelines JSON blob (parsed above). The optional top-level
  // `node.skill_specific_filming_notes` field on the TrainingNode type has
  // no DB column and is not written by any UI surface — it is dead/unbacked
  // and the camera_guidelines JSON is the canonical source. If a top-level
  // column is added later, prefer it via `node.skill_specific_filming_notes
  // ?? camera.skill_specific_filming_notes`.
  let out = `## Reference Calibrations\n\nCount: ${calibratedCount} of 3 camera angles calibrated\nSkill-Specific Filming Notes: ${camera.skill_specific_filming_notes?.trim() || "Not configured"}\n`;

  for (const angle of ANGLES) {
    const cal = cals.find(c => c.camera_angle === angle.key);
    const calibrated = cal && cal.pixels_per_yard && cal.pixels_per_yard > 0;
    const status = calibrated ? "✅ Calibrated" : "⬜ Not Calibrated";
    out += `\n### ${angle.label} ${status}\nPixels Per Yard: ${cal?.pixels_per_yard ?? "Not set"}\n`;
  }

  return out;
}

function generateCamera(node: TrainingNode): string {
  const cam = parseCameraSettings(node.camera_guidelines);
  const metrics = getActiveMetrics(node);

  // Build body part groups from metrics
  const bodyPartGroups = new Map<string, { indices: Set<number>; metrics: string[] }>();
  for (const m of metrics) {
    const indices = m.keypoint_mapping?.keypoint_indices ?? [];
    for (const idx of indices) {
      const kp = keypointLibrary.keypoints.find((k) => k.index === idx);
      if (kp) {
        const group = kp.sub_group || kp.group;
        if (!bodyPartGroups.has(group)) bodyPartGroups.set(group, { indices: new Set(), metrics: [] });
        const g = bodyPartGroups.get(group);
        if (!g) continue;
        g.indices.add(idx);
        if (!g.metrics.includes(m.name)) g.metrics.push(m.name);
      }
    }
  }

  let out = `## Filming Guidance\n\nRecommended Distance: ${cam.camera_min_distance ?? "not set"} to ${cam.camera_max_distance ?? "not set"} yards\nDuration Range: ${node.clip_duration_min}s to ${node.clip_duration_max}s (read-only — set in Basics tab)\n`;

  if (bodyPartGroups.size > 0) {
    out += `\nRequired Visible Body Parts (derived from active Metrics keypoint mappings):\n`;
    for (const [group, data] of bodyPartGroups) {
      const idxArr = Array.from(data.indices);
      out += `  ${group} (indices: ${idxArr.join(", ")})\n  Required for: ${data.metrics.join(", ")}\n`;
    }
  }

  out += `\nAthlete Filming Instructions:\n${cam.camera_filming_instructions?.trim() || "Not configured"}`;
  return out;
}

function generatePrompt(node: TrainingNode): string {
  const template = node.llm_prompt_template ?? "";
  const sysInstructions = node.llm_system_instructions ?? "";
  const combinedText = template + "\n" + sysInstructions;
  const vars = Array.from(new Set(Array.from(combinedText.matchAll(/\{\{(.+?)\}\}/g)).map(m => m[1])));

  const recommended = ["mastery_score", "metric_results", "phase_scores", "confidence_flags", "detected_errors", "athlete_name", "node_name", "athlete_level", "focus_area", "skipped_metrics"];
  const missing = recommended.filter(v => !vars.includes(v));

  let out = `## LLM Prompt Configuration\n\nOutput Token Cap (fixed): ${MAX_COACH_OUTPUT_TOKENS}\nFeedback Word Budget: ${TARGET_FEEDBACK_WORDS.min}–${TARGET_FEEDBACK_WORDS.max} words; rejects above ${MAX_FEEDBACK_WORDS}\n\nSystem Instructions:\n${node.llm_system_instructions?.trim() || "Not configured"}\n\nPrompt Template:\n${template.trim() || "Not configured"}\n\nVariables Detected in Template:\n${vars.length > 0 ? vars.map(v => `{{${v}}}`).join(", ") : "None detected — WARNING: no template variables found, Claude will generate generic feedback without real metric data"}\n\nRecommended Variables Not Present:\n${missing.length > 0 ? missing.map(v => `{{${v}}}`).join(", ") : "None — all key variables present"}`;
  return out;
}

function generateBadges(node: TrainingNode): string {
  const badges = node.badges ?? [];
  if (badges.length === 0) return "## Badges\n\nNo badges defined.";

  const metrics = node.key_metrics ?? [];
  const condTypeMap: Record<string, string> = { score: "score_based", metric: "metric_based", streak: "streak_based", custom: "custom" };

  let out = `## Badges (${badges.length} defined)\n`;
  for (const b of badges) {
    const metricName = b.condition_metric_id ? (metrics.find(m => m.name === b.condition_metric_id)?.name ?? b.condition_metric_id) : "N/A";
    const op = (b as unknown as Record<string, unknown>).condition_operator as string | undefined;
    const conditionLine = op === "+-"
      ? `Condition: within ± ${b.condition_count} of ${b.condition_threshold}\nRequired Count: ${b.condition_count} analyses`
      : `Threshold: ${b.condition_threshold}\nRequired Count: ${b.condition_count} analyses`;
    out += `\n### ${b.icon} ${b.name} — ${b.rarity}\nDescription: ${b.description || "Not configured"}\nCondition Type: ${condTypeMap[b.condition_type] ?? b.condition_type}\nOperator: ${op || "Not configured"}\n${conditionLine}\nMetric: ${metricName}\nCustom Condition: ${b.condition_custom?.trim() || "Not configured"}\nLegacy Condition Text: ${b.condition?.trim() || "Not configured"}\nSequence Order: ${b.sequence_order}\n`;
  }
  return out;
}

function generateKnowledgeBase(node: TrainingNode): string {
  const knowledgeBase = node.knowledge_base ?? {};
  const entries = Object.entries(knowledgeBase).filter(([, sections]) => Array.isArray(sections) && sections.length > 0);

  if (entries.length === 0) {
    return "## Admin Guidance / Knowledge Base\n\nNo tab guidance configured.";
  }

  let out = "## Admin Guidance / Knowledge Base\n";
  for (const [tabKey, sections] of entries) {
    out += `\n### ${tabKey.replace(/_/g, " ")}\n`;
    sections.forEach((section, index) => {
      out += `\n#### ${index + 1}. ${section.sectionTitle || "Untitled Section"}\n${section.content?.trim() || "Not configured"}\n`;
    });
  }

  return out;
}

// Phase 1c.3-C: generateTrainingStatus() removed. The Training Status tab's
// underlying columns (solution_class, performance_mode, det_frequency,
// tracking_enabled) were dropped in migration 20260426025918. Per Q3a
// decision, the export's Training Status section is deleted entirely
// rather than retained with placeholder values.

// Phase 1c.3-D (Decision H): tab generators now combine merged sub-section
// markdown for the consolidated 8-tab set. Copying the Metrics tab returns
// metrics + scoring + errors; Reference returns reference + camera; Phases
// returns proportional phases; Basics omits retired detection settings.
// The surviving single-section generators (generateScoring/Errors/Camera) are called as
// composable building blocks — only the tab-key surface collapsed.
const TAB_GENERATORS: Record<TabKey, (node: TrainingNode) => string> = {
  basics: generateBasics,
  videos: generateVideos,
  phases: generatePhases,
  metrics: (node) => `${generateMetrics(node)}\n\n${generateScoring(node)}\n\n${generateErrors(node)}`,
  reference: (node) => `${generateReference(node)}\n\n${generateCamera(node)}`,
  prompt: generatePrompt,
  badges: generateBadges,
};

const TAB_LABELS: Record<TabKey, string> = {
  basics: "Basics",
  videos: "Videos",
  phases: "Phases",
  metrics: "Metrics",
  reference: "Reference",
  prompt: "LLM Prompt",
  badges: "Badges",
};

export function generateTabMarkdown(node: TrainingNode, tabKey: TabKey | LegacyTabKey): string {
  // Phase 1c.3-D: tolerate stale callers passing legacy tab keys (scoring,
  // errors, camera, checkpoints, mechanics, training_status). Redirect to the
  // consolidated parent so copy-tab never returns an empty string.
  const REDIRECT: Record<LegacyTabKey, TabKey> = {
    mechanics: "phases",
    scoring: "metrics",
    errors: "metrics",
    camera: "reference",
    checkpoints: "phases",
    training_status: "basics",
  };
  const resolved = (REDIRECT[tabKey as LegacyTabKey] ?? tabKey) as TabKey;
  const gen = TAB_GENERATORS[resolved];
  if (!gen) return "";
  const label = TAB_LABELS[resolved] ?? resolved;
  return `${header(node, label)}\n${gen(node)}`;
}

export function generateFullNodeMarkdown(node: TrainingNode): string {
  const categories = computeCategories(node);
  const score = computeScore(categories);

  let readiness = `## NODE READINESS: ${score}%\n\n`;
  const blockingItems: string[] = [];
  for (const cat of categories) {
    const blocking = cat.checks.filter(c => !c.warning);
    const allPass = blocking.length > 0 ? blocking.every(c => c.pass) : true;
    const failingItems = cat.checks.filter(c => !c.pass && !c.warning).map(c => c.label);
    readiness += `${allPass ? "PASS" : "FAIL"} ${cat.name} (${cat.weight}%)\n  Status: ${cat.checks.filter(c => c.pass).map(c => c.label).join(" · ") || "No checks"}\n`;
    if (failingItems.length > 0) {
      readiness += `  Failing items: ${failingItems.join(", ")}\n`;
      blockingItems.push(...failingItems.map(f => `${cat.name}: ${f}`));
    }
  }
  readiness += `\nBLOCKING ITEMS:\n${blockingItems.length > 0 ? blockingItems.join("\n") : "None — node is ready for Live"}`;

  // Phase 1c.3-D: tab order matches the consolidated TABS array in
  // NodeEditor (8 tabs, minus "test" which has no markdown export).
  // Retired keys (mechanics/scoring/errors/camera/checkpoints/training_status)
  // are folded into their consolidated parents inside TAB_GENERATORS.
  const tabOrder: TabKey[] = ["basics", "videos", "phases", "metrics", "reference", "prompt", "badges"];

  // The trailing knowledge-base block is admin-authored markdown (headings,
  // bullets, bold) intended for internal reference, NOT pipeline config.
  // Without an explicit boundary it can read like stray markup tacked onto
  // the end of Training Status. Insert a labeled block so admins and the
  // LLM both see it as a separate, non-config payload.
  const adminGuidanceBoundary = [
    "# ADMIN GUIDANCE — non-config notes authored by admins for internal reference.",
    "# Not part of the node config the pipeline reads. Safe to ignore for analysis.",
  ].join("\n");

  const tabSections = tabOrder.map(key => TAB_GENERATORS[key](node));
  const sections = [
    ...tabSections,
    `${adminGuidanceBoundary}\n\n${generateKnowledgeBase(node)}`,
  ].join("\n\n---\n\n");

  const fullText = `${readiness}\n\n---\n\n${sections}`;
  const wordCount = fullText.split(/\s+/).length;

  return `# AthleteLab Node — Full Configuration Export\n# Node: ${node.name}\n# Status: ${node.status === "live" ? "Live" : "Draft"}\n# Version: ${node.node_version ?? 1}\n# Includes tab exports plus admin guidance / knowledge base\n# Copied: ${ts()}\n# Approximate word count: ${wordCount} words\n\n---\n\n${fullText}`;
}
