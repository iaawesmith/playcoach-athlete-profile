import type { TrainingNode, MechanicsSection, Checkpoint, KeyMetric } from "../types";
import { parseCameraSettings } from "../components/CameraEditor";
import { migrateCheckpoints } from "../components/CheckpointsEditor";
import { computeCategories, computeScore } from "../components/NodeReadinessBar";
import keypointLibrary from "@/constants/keypointLibrary.json";

type TabKey = "basics" | "videos" | "overview" | "mechanics" | "metrics" | "scoring" | "errors" | "phases" | "reference" | "camera" | "checkpoints" | "prompt" | "badges" | "training_status";

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
  if (maxIdx >= 23) return "Wholebody";
  if (maxIdx >= 17) return "Body_with_feet";
  return "Body";
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
  return `## Basics\n\nNode Name: ${node.name}\nClip Duration: ${node.clip_duration_min}s to ${node.clip_duration_max}s\nStatus: ${node.status === "live" ? "Live" : "Draft"}\nNode Version: ${node.node_version ?? 1}\nIcon: ${node.icon_url || "not set"}`;
}

function generateVideos(node: TrainingNode): string {
  const vids = node.elite_videos ?? [];
  let out = `## Videos (${vids.length} videos configured)\n`;
  if (vids.length === 0) return out + "\nNo videos configured.";
  vids.forEach((v, i) => {
    out += `\n### Video ${i + 1}: ${v.label || "Untitled"}\nURL: ${v.url}\nClip Window: ${v.start_seconds ?? "not set"}s to ${v.end_seconds ?? "not set"}s\nCamera Angle: ${v.camera_angle || "not set"}\nType: ${v.video_type === "educational" ? "Educational" : v.video_type === "analysis" ? "Analysis" : "Both"}\nReference: ${v.is_reference ? "Yes" : "No"}\n`;
  });
  return out;
}

function generateOverview(node: TrainingNode): string {
  return `## Overview\n\n${node.overview?.trim() || "Not configured"}`;
}

function generatePhases(node: TrainingNode): string {
  const phases = node.phase_breakdown ?? [];
  const seg = node.segmentation_method ?? "proportional";
  const weightSum = phases.reduce((s, p) => s + (p.proportion_weight ?? 0), 0);
  const segLabel = seg === "proportional" ? "Proportional" : "Checkpoint-triggered";
  let out = `## Phases\n\nCount: ${phases.length} phases\nSegmentation Method: ${segLabel}\nWeight Sum: ${weightSum}% ${weightSum === 100 ? "PASS" : "FAIL"}\n`;
  phases.forEach((p, i) => {
    out += `\n### Phase ${i + 1}: ${p.name} — ${p.proportion_weight ?? 0}% of clip\nDescription: ${p.description || "Not configured"}\nFrame Buffer: ${p.frame_buffer ?? 3} frames\n`;
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
  const metrics = node.key_metrics ?? [];
  const phases = node.phase_breakdown ?? [];
  const weightSum = metrics.reduce((s, m) => s + m.weight, 0);
  const maxIdx = getMaxKeypointIndex(metrics);
  const requiredClass = maxIdx >= 0 ? deriveRequiredSolutionClass(maxIdx) : "None (no keypoints)";

  let out = `## Metrics\n\nCount: ${metrics.length} metrics\nWeight Sum: ${weightSum}% ${weightSum === 100 ? "PASS" : "FAIL"}\nSolution Class Required: ${requiredClass}\n`;

  metrics.forEach((m, i) => {
    const km = m.keypoint_mapping;
    const phaseName = km?.phase_id ? (phases.find(p => p.id === km.phase_id)?.name ?? "Unknown") : null;
    const phaseStatus = phaseName ? `${phaseName} ASSIGNED` : "MISSING";

    // Check mapping completeness
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

    out += `\n### Metric ${i + 1}: ${m.name || "Untitled"} (${m.weight}%)\nDescription: ${m.description?.trim() || "Not configured"}\nUnit: ${m.unit || "Not configured"}\nElite Target: ${m.eliteTarget || "Not configured"}\nTolerance: ±${m.tolerance ?? "Not configured"}\nPhase: ${phaseStatus}\nTemporal Window: ${m.temporal_window ?? 1} frames\nCalculation Type: ${km?.calculation_type || "Not configured"}\nBody Groups: ${km?.body_groups?.length ? km.body_groups.join(", ") : "None"}\nKeypoint Indices: ${km?.keypoint_indices?.join(", ") || "None"}\nKeypoint Names: ${km?.keypoint_indices?.length ? kpNames(km.keypoint_indices) : "None"}\nBilateral: ${km?.bilateral ?? "auto"}\nDirection Override: ${km?.bilateral_override ?? "auto"}\nConfidence Threshold: ${km?.confidence_threshold ?? 0.7}\nDepends On: ${m.depends_on_metric_id ? (metrics.find(x => x.name === m.depends_on_metric_id)?.name ?? m.depends_on_metric_id) : "None"}\nRequires Catch: ${m.requires_catch ? "Yes" : "No"}\nKeypoint Mapping: ${mappingStatus}${missing.length > 0 ? ` — missing: ${missing.join(", ")}` : ""}\n`;
  });
  return out;
}

function generateScoring(node: TrainingNode): string {
  const bands = node.score_bands ?? { elite: "Elite", varsity: "Varsity Ready", developing: "Developing", needs_work: "Needs Work" };
  const renorm = node.scoring_renormalize_on_skip ?? true;
  const catchWeight = node.key_metrics.filter(m => m.requires_catch).reduce((s, m) => s + m.weight, 0);
  let renormLine = `Renormalize on Skip: ${renorm ? "Yes" : "No"}`;
  if (!renorm) {
    renormLine += `\nMax score when catch excluded: ${100 - catchWeight}%`;
  }
  return `## Scoring\n\nScoring Formula Description:\n${node.scoring_rules?.trim() || "Not configured"}\n\nLow Confidence Handling: ${node.confidence_handling ?? "skip"}\nMin Metrics Threshold: ${node.min_metrics_threshold ?? 50}%\n${renormLine}\n\nScore Bands:\n  90-100: ${bands.elite}\n  75-89: ${bands.varsity}\n  60-74: ${bands.developing}\n  Below 60: ${bands.needs_work}`;
}

function generateErrors(node: TrainingNode): string {
  const errors = node.common_errors ?? [];
  let out = `## Errors (${errors.length} errors defined)\n`;
  if (errors.length === 0) return out + "\nNo errors defined.";
  errors.forEach((e, i) => {
    out += `\n### Error ${i + 1}: ${e.error} — ${e.severity ?? "common"}\nDescription: ${e.correction || "Not configured"}\nAuto-Detectable: ${e.auto_detectable ? "Yes" : "No"}\nDetection Condition: ${e.auto_detection_condition || "Not configured"}\n`;
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

  const fallbackMap: Record<string, string> = {
    pixel_warning: "Use pixel units with warning",
    disable_distance: "Disable distance metrics",
    estimate_field_lines: "Estimate using field lines",
  };
  const rawFallback = node.reference_fallback_behavior ?? "pixel_warning";
  const fallbackLabel = fallbackMap[rawFallback] ?? rawFallback;

  const camera = parseCameraSettings(node.camera_guidelines);
  let out = `## Reference Calibrations\n\nCount: ${calibratedCount} of 3 camera angles calibrated\nFallback Behavior: ${fallbackLabel}\nSkill-Specific Filming Notes: ${camera.skill_specific_filming_notes?.trim() || "Not configured"}\nGeneric Fallback Filming Instructions: ${node.reference_filming_instructions?.trim() || "Not configured"}\n`;

  for (const angle of ANGLES) {
    const cal = cals.find(c => c.camera_angle === angle.key);
    const calibrated = cal && cal.pixels_per_yard && cal.pixels_per_yard > 0;
    const status = calibrated ? "✅ Calibrated" : "⬜ Not Calibrated";
    const supportStatus = cal?.status ? cal.status.replace(/_/g, " ") : "supported";
    const knownSize = cal?.known_size_yards != null ? `${cal.known_size_yards} ${cal.known_size_unit || "yards"}` : "Not set";
    out += `\n### ${angle.label} ${status}\nSupport Status: ${supportStatus}\nReference Object: ${cal?.reference_object_name || "Not configured"}\nKnown Size: ${knownSize}\nPixels Per Yard: ${cal?.pixels_per_yard ?? "Not set"}\nPlacement Instructions: ${cal?.placement_instructions?.trim() || "Not configured"}\nGeneric Fallback Angle Instructions: ${cal?.filming_instructions?.trim() || "Not configured"}\nCalibration Notes: ${cal?.calibration_notes?.trim() || "Not configured"}\n`;
  }

  return out;
}

function generateCamera(node: TrainingNode): string {
  const cam = parseCameraSettings(node.camera_guidelines);
  const metrics = node.key_metrics ?? [];

  // Build body part groups from metrics
  const bodyPartGroups = new Map<string, { indices: Set<number>; metrics: string[] }>();
  for (const m of metrics) {
    const indices = m.keypoint_mapping?.keypoint_indices ?? [];
    for (const idx of indices) {
      const kp = (keypointLibrary as any).keypoints.find((k: any) => k.index === idx);
      if (kp) {
        const group = kp.sub_group || kp.group;
        if (!bodyPartGroups.has(group)) bodyPartGroups.set(group, { indices: new Set(), metrics: [] });
        const g = bodyPartGroups.get(group)!;
        g.indices.add(idx);
        if (!g.metrics.includes(m.name)) g.metrics.push(m.name);
      }
    }
  }

  let out = `## Camera Requirements\n\nMin FPS: ${cam.camera_min_fps}\nMin Resolution: ${cam.camera_min_resolution}\nRecommended Distance: ${cam.camera_min_distance ?? "not set"} to ${cam.camera_max_distance ?? "not set"} yards\n\nAuto-Reject Rules:\n  Athlete frame size: less than ${cam.auto_reject_athlete_too_small_threshold}% of frame height${cam.auto_reject_athlete_too_small ? "" : " (DISABLED)"}\n  Keypoint confidence: less than ${cam.auto_reject_keypoint_confidence_threshold}${cam.auto_reject_keypoint_confidence_low ? "" : " (DISABLED)"}\n  Duration: outside ${node.clip_duration_min}s to ${node.clip_duration_max}s range${cam.auto_reject_duration_out_of_range ? "" : " (DISABLED)"}\n  Resolution: below minimum${cam.auto_reject_resolution_below_min ? "" : " (DISABLED)"}\n`;

  if (bodyPartGroups.size > 0) {
    out += `\nRequired Visible Body Parts (derived from Metrics keypoint mappings):\n`;
    for (const [group, data] of bodyPartGroups) {
      const idxArr = Array.from(data.indices);
      const needsWholebody = idxArr.some(i => i >= 23);
      out += `  ${group} (indices: ${idxArr.join(", ")})\n  Required for: ${data.metrics.join(", ")}\n`;
      if (needsWholebody) out += `  NOTE: Requires Wholebody solution class\n`;
    }
  }

  out += `\nAthlete Filming Instructions:\n${cam.camera_filming_instructions?.trim() || "Not configured"}`;
  return out;
}

function generateCheckpoints(node: TrainingNode): string {
  const cps = migrateCheckpoints(node.form_checkpoints);
  const phases = node.phase_breakdown ?? [];
  const seg = node.segmentation_method ?? "proportional";

  if (cps.length === 0) {
    return `## Checkpoints\n\nNo checkpoints defined.\nSegmentation Method: ${seg === "proportional" ? "Proportional" : "Checkpoint-triggered"}\nNote: Checkpoints are only required when Segmentation Method = Checkpoint-triggered.`;
  }

  let out = `## Checkpoints\n\nCount: ${cps.length} defined\nSegmentation Method: ${seg === "proportional" ? "Proportional" : "Checkpoint-triggered"}\n`;
  cps.forEach((cp, i) => {
    const phaseName = cp.phase_id ? (phases.find(p => p.id === cp.phase_id)?.name ?? "Unknown") : "Not assigned";
    out += `\n### Checkpoint ${i + 1}: ${cp.name} (Priority ${cp.priority})\nDescription: ${cp.description?.trim() || "Not configured"}\nPhase: ${phaseName}\nTransition Role: ${cp.phase_transition_role}\nTrigger Condition: ${cp.trigger_condition || "Not configured"}\nRequired Keypoints: ${cp.required_keypoint_indices.join(", ")} — ${kpNames(cp.required_keypoint_indices)}\nConfidence Threshold: ${cp.confidence_threshold}\n`;
  });
  return out;
}

function generatePrompt(node: TrainingNode): string {
  const toneMap: Record<string, string> = { encouraging: "Encouraging", direct: "Direct", technical: "Technical" };
  const template = node.llm_prompt_template ?? "";
  const sysInstructions = node.llm_system_instructions ?? "";
  const combinedText = template + "\n" + sysInstructions;
  const vars = Array.from(new Set(Array.from(combinedText.matchAll(/\{\{(.+?)\}\}/g)).map(m => m[1])));

  const recommended = ["mastery_score", "metric_results", "phase_scores", "confidence_flags", "detected_errors", "athlete_name", "node_name", "athlete_level", "focus_area", "skipped_metrics"];
  const missing = recommended.filter(v => !vars.includes(v));

  let out = `## LLM Prompt Configuration\n\nTone: ${toneMap[node.llm_tone ?? "direct"] ?? node.llm_tone ?? "Direct"}\nMax Feedback Length: ${node.llm_max_words ?? 150} words\n\nSystem Instructions:\n${node.llm_system_instructions?.trim() || "Not configured"}\n\nPrompt Template:\n${template.trim() || "Not configured"}\n\nVariables Detected in Template:\n${vars.length > 0 ? vars.map(v => `{{${v}}}`).join(", ") : "None detected — WARNING: no template variables found, Claude will generate generic feedback without real metric data"}\n\nRecommended Variables Not Present:\n${missing.length > 0 ? missing.map(v => `{{${v}}}`).join(", ") : "None — all key variables present"}`;
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
    out += `\n### ${b.icon} ${b.name} — ${b.rarity}\nDescription: ${b.description || "Not configured"}\nCondition Type: ${condTypeMap[b.condition_type] ?? b.condition_type}\n${conditionLine}\nMetric: ${metricName}\n`;
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

function generateTrainingStatus(node: TrainingNode): string {
  const metrics = node.key_metrics ?? [];
  const maxIdx = getMaxKeypointIndex(metrics);
  const derivedClass = maxIdx >= 0 ? deriveRequiredSolutionClass(maxIdx) : "N/A";
  const rawClass = node.solution_class || "";
  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const configuredClass = rawClass ? capitalize(rawClass) : "NOT CONFIGURED — BLOCKING";

  let compatibility = "COMPATIBLE";
  if (!node.solution_class) {
    compatibility = "NOT CONFIGURED";
  } else {
    for (const m of metrics) {
      const indices = m.keypoint_mapping?.keypoint_indices ?? [];
      if (node.solution_class === "body" && indices.some(i => i >= 17)) {
        const needed = indices.some(i => i >= 23) ? "Wholebody" : "Body_with_feet";
        compatibility = `MISMATCH — ${m.name} uses keypoint index ${Math.max(...indices.filter(i => i >= 17))} which requires ${needed} but node is configured for ${capitalize(node.solution_class!)}`;
        break;
      }
      if (node.solution_class === "body_with_feet" && indices.some(i => i >= 91)) {
        compatibility = `MISMATCH — ${m.name} uses keypoint index ${Math.max(...indices.filter(i => i >= 91))} which requires Wholebody but node is configured for ${capitalize(node.solution_class!)}`;
        break;
      }
    }
  }

  const dfSolo = node.det_frequency_solo ?? 2;
  const dfDefender = node.det_frequency_defender ?? 1;
  const dfMultiple = node.det_frequency_multiple ?? 1;
  const dfFallback = node.det_frequency ?? 7;
  const te = node.tracking_enabled ? "True" : "False";
  const pmMode = node.performance_mode ?? "balanced";

  const pipelineRef = rawClass
    ? `\n\nPipeline Reference (rtmlib instantiation):\n\`\`\`python\nfrom rtmlib import PoseTracker, ${configuredClass}\n\n# Solo analysis (1 person)\npose_tracker = PoseTracker(\n    ${configuredClass},\n    det_frequency=${dfSolo},  # solo\n    tracking=${te},\n    mode='${pmMode}',\n    backend='onnxruntime',\n    device='cuda'\n)\n\n# With defender (2 people)\npose_tracker = PoseTracker(\n    ${configuredClass},\n    det_frequency=${dfDefender},  # with_defender\n    tracking=${te},\n    mode='${pmMode}',\n    backend='onnxruntime',\n    device='cuda'\n)\n\n# Multiple people\npose_tracker = PoseTracker(\n    ${configuredClass},\n    det_frequency=${dfMultiple},  # multiple\n    tracking=${te},\n    mode='${pmMode}',\n    backend='onnxruntime',\n    device='cuda'\n)\n\`\`\``
    : "";

  return `## Training Status\n\nSolution Class: ${configuredClass}\nPerformance Mode: ${pmMode}\nDetection Frequency:\n  Solo: ${dfSolo} frames\n  With Defender: ${dfDefender} frames\n  Multiple People: ${dfMultiple} frames\n  Fallback: ${dfFallback} frames\nTracking: ${node.tracking_enabled ? "On" : "Off"}\n\nKeypoint Compatibility Check:\n  Highest keypoint index used across all metrics: ${maxIdx >= 0 ? maxIdx : "N/A"}\n  Minimum required solution class: ${derivedClass}\n  Configured solution class: ${configuredClass}\n  Compatibility: ${compatibility}${pipelineRef}`;
}

const TAB_GENERATORS: Record<TabKey, (node: TrainingNode) => string> = {
  basics: generateBasics,
  videos: generateVideos,
  overview: generateOverview,
  phases: generatePhases,
  mechanics: generateMechanics,
  metrics: generateMetrics,
  scoring: generateScoring,
  errors: generateErrors,
  reference: generateReference,
  camera: generateCamera,
  checkpoints: generateCheckpoints,
  prompt: generatePrompt,
  badges: generateBadges,
  training_status: generateTrainingStatus,
};

const TAB_LABELS: Record<TabKey, string> = {
  basics: "Basics",
  videos: "Videos",
  overview: "Overview",
  phases: "Phases",
  mechanics: "Mechanics",
  metrics: "Metrics",
  scoring: "Scoring",
  errors: "Errors",
  reference: "Reference",
  camera: "Camera",
  checkpoints: "Checkpoints",
  prompt: "LLM Prompt",
  badges: "Badges",
  training_status: "Training Status",
};

export function generateTabMarkdown(node: TrainingNode, tabKey: TabKey): string {
  const gen = TAB_GENERATORS[tabKey];
  if (!gen) return "";
  const label = TAB_LABELS[tabKey] ?? tabKey;
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

  const tabOrder: TabKey[] = ["basics", "videos", "overview", "phases", "mechanics", "metrics", "scoring", "errors", "reference", "camera", "checkpoints", "prompt", "badges", "training_status"];

  const sections = [...tabOrder.map(key => TAB_GENERATORS[key](node)), generateKnowledgeBase(node)].join("\n\n---\n\n");

  const fullText = `${readiness}\n\n---\n\n${sections}`;
  const wordCount = fullText.split(/\s+/).length;

  return `# AthleteLab Node — Full Configuration Export\n# Node: ${node.name}\n# Status: ${node.status === "live" ? "Live" : "Draft"}\n# Version: ${node.node_version ?? 1}\n# Solution Class: ${node.solution_class || "Not configured"}\n# Includes tab exports plus admin guidance / knowledge base\n# Copied: ${ts()}\n# Approximate word count: ${wordCount} words\n\n---\n\n${fullText}`;
}
