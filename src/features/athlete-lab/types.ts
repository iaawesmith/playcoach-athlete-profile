export type CalculationType = "angle" | "distance" | "velocity" | "acceleration" | "frame_delta";
export type BilateralMode = "auto" | "left" | "right";

export type BilateralOverride = "auto" | "force_left" | "force_right";

export interface KeypointMapping {
  body_groups: string[];
  keypoint_indices: number[];
  calculation_type: CalculationType | null;
  bilateral: BilateralMode;
  bilateral_override: BilateralOverride;
  confidence_threshold: number;
  phase_id: string | null;
}

export interface KeyMetric {
  name: string;
  description: string;
  eliteTarget: string;
  unit: string;
  weight: number;
  tolerance?: number | null;
  temporal_window?: number;
  depends_on_metric_id?: string | null;
  keypoint_mapping?: KeypointMapping | null;
  requires_catch?: boolean;
}

export type ErrorSeverity = "minor" | "common" | "critical";

export interface CommonError {
  error: string;
  correction: string;
  severity?: ErrorSeverity;
  auto_detection_condition?: string;
  auto_detectable?: boolean;
}

export interface PhaseNote {
  id?: string;
  phase: string;
  notes: string;
  weight?: number;
  frame_buffer?: number;
}

export type SegmentationMethod = "proportional" | "checkpoint";

export type PhaseTransitionRole = "marks_start" | "marks_end" | "informational";

export interface Checkpoint {
  id: string;
  name: string;
  description: string;
  phase_id: string | null;
  phase_transition_role: PhaseTransitionRole;
  trigger_condition: string;
  required_keypoint_indices: number[];
  confidence_threshold: number;
  priority: number;
  sequence_order: number;
}

export interface MechanicsSection {
  id: string;
  phase_id: string | null;
  content: string;
}

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";
export type BadgeConditionType = "score" | "metric" | "streak" | "custom";

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: BadgeRarity;
  condition: string;
  condition_type: BadgeConditionType;
  condition_operator: string;
  condition_threshold: number;
  condition_metric_id: string | null;
  condition_count: number;
  condition_custom: string | null;
  sequence_order: number;
}

export type CameraAngle = "sideline" | "endzone" | "behind_qb";
export type VideoType = "educational" | "analysis" | "both";

export interface EliteVideo {
  url: string;
  label: string;
  start_seconds?: number | null;
  end_seconds?: number | null;
  camera_angle?: CameraAngle | null;
  video_type?: VideoType;
  is_reference?: boolean;
}

export interface KnowledgeSection {
  id: string;
  sectionTitle: string;
  content: string;
}

export type NodePosition = "WR" | "QB" | "RB";

export type NodeStatus = "draft" | "live";

export type ConfidenceHandling = "skip" | "penalize" | "flag_only";

export type ReferenceFallback = "pixel_warning" | "disable_distance" | "estimate_field_lines";

export interface ReferenceCalibration {
  camera_angle: CameraAngle;
  reference_object_name: string;
  known_size_yards: number | null;
  placement_instructions: string;
  pixels_per_yard: number | null;
}

export interface ScoreBands {
  elite: string;
  varsity: string;
  developing: string;
  needs_work: string;
}

export type PerformanceMode = "performance" | "balanced" | "lightweight";

export interface TrainingNode {
  id: string;
  name: string;
  icon_url: string | null;
  position: NodePosition | null;
  status: NodeStatus;
  clip_duration_min: number;
  clip_duration_max: number;
  node_version: number;
  overview: string;
  pro_mechanics: string;
  key_metrics: KeyMetric[];
  scoring_rules: string;
  common_errors: CommonError[];
  phase_breakdown: PhaseNote[];
  reference_object: string;
  camera_guidelines: string;
  form_checkpoints: Checkpoint[];
  llm_prompt_template: string;
  llm_tone: string;
  llm_max_words: number;
  llm_system_instructions: string;
  badges: Badge[];
  elite_videos: EliteVideo[];
  knowledge_base: Record<string, KnowledgeSection[]>;
  segmentation_method: SegmentationMethod;
  confidence_handling: ConfidenceHandling;
  min_metrics_threshold: number;
  score_bands: ScoreBands;
  solution_class: string;
  reference_calibrations: ReferenceCalibration[];
  reference_filming_instructions: string;
  reference_fallback_behavior: ReferenceFallback;
  performance_mode: PerformanceMode;
  det_frequency: number;
  tracking_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PreflightCheck {
  name: string;
  expected: string;
  actual: string;
  result: "PASS" | "WARN" | "FAIL";
}

export interface PhaseWindow {
  phase: string;
  start: number;
  end: number;
  frame_count: number;
  percent: number;
}

export interface KeypointConfidence {
  index: number;
  name: string;
  mean_confidence: number;
  min_confidence: number;
  min_frame: number;
  frames_below: number;
  total_frames: number;
  percent_below: number;
  status: "RELIABLE" | "MARGINAL" | "UNRELIABLE";
}

export interface MetricLogEntry {
  name: string;
  weight: number;
  phase: string;
  frames_evaluated: number;
  frame_range: string;
  keypoints: string;
  calculation_type: string;
  temporal_window: number;
  extracted_values?: string;
  calculated_result: string;
  unit: string;
  elite_target: string;
  deviation: string;
  raw_score: number;
  weighted_contribution: string;
  status: "SCORED" | "SKIPPED" | "FLAGGED";
  skip_reason?: string;
}

export interface ErrorDetectionEntry {
  name: string;
  auto_detectable: boolean;
  condition: string;
  metric_value: string;
  evaluation_expression: string;
  triggered: boolean;
}

export interface AnalysisLogData {
  timestamp?: string;
  preflight: {
    checks: PreflightCheck[];
    pipeline_stopped?: boolean;
    stop_reason?: string;
  };
  rtmlib?: {
    solution_class?: string;
    model?: string;
    backend?: string;
    total_frames?: number;
    source_fps?: number;
    processing_time_ms?: number;
    phase_windows?: PhaseWindow[];
    keypoint_confidence?: KeypointConfidence[];
  };
  metrics?: MetricLogEntry[];
  aggregate?: {
    mastery_score: number;
    confidence_adjusted: boolean;
    metrics_skipped: number;
    metrics_total: number;
  };
  error_detection?: ErrorDetectionEntry[];
  claude_api?: {
    model?: string;
    system_instructions_present?: boolean;
    system_instructions_chars?: number;
    variables_injected?: Array<{ name: string; value_summary: string; present: boolean }>;
    missing_variables?: string[];
    prompt_tokens?: number;
    system_tokens?: number;
    template_tokens?: number;
    variable_tokens?: number;
    response_tokens?: number;
    total_tokens?: number;
    word_count?: number;
    target_words?: number;
    truncated?: boolean;
    status?: "COMPLETE" | "FAILED";
  };
}

export interface AnalysisResult {
  overallScore: number;
  phaseBreakdown: Array<{ phase: string; score: number; feedback: string }>;
  metricScores: Array<{ name: string; score: number; value: string; target: string; difference: string }>;
  strengths: string[];
  improvements: string[];
  coachFeedback: string;
  confidence: number;
  eliteComparison: string;
  warnings: string[];
  log_data?: AnalysisLogData;
}
