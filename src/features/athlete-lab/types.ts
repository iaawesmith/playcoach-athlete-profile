export type CalculationType = "angle" | "distance" | "velocity" | "acceleration" | "frame_delta" | "distance_variance";
// 'none' = the metric's keypoint indices already span both sides (e.g. hips
// [23,24]) or reference a center keypoint (nose, hip-center). The analyzer
// uses base indices verbatim — no mirroring, no side selection.
export type BilateralMode = "auto" | "left" | "right" | "none";

export type BilateralOverride = "auto" | "force_left" | "force_right" | "none";

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
  /** Short (2-3 sentence) athlete/LLM-facing description. Sent to Claude as coaching context. */
  description: string;
  /**
   * Admin-only documentation. Multi-paragraph markdown explaining metric derivation,
   * technical limitations, and upgrade paths. NEVER sent to athletes or to the LLM —
   * surfaced only inside the admin metric editor and node text exports.
   */
  internal_documentation?: string;
  eliteTarget: string;
  unit: string;
  weight: number;
  tolerance?: number | null;
  temporal_window?: number;
  depends_on_metric_id?: string | null;
  keypoint_mapping?: KeypointMapping | null;
  requires_catch?: boolean;
  /** When false, this metric is preserved in storage but excluded from UI editing and scoring. Defaults to true. */
  active?: boolean;
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
  name: string;
  description: string;
  /**
   * Phase 1c.1 Slice 2 — coaching cues for this phase.
   * Migrated from `pro_mechanics` (per-phase JSON) and from inline
   * `— Coaching cues —` separator content embedded in `description`.
   * Empty string is the default and produces zero Claude prompt change.
   */
  coaching_cues?: string;
  sequence_order?: number;
  proportion_weight?: number;
  frame_buffer?: number;
}

/**
 * Phase 1c.1 Slice 2 — per-node lifecycle for the Mechanics → Phases coaching cues migration.
 * Stored as `athlete_lab_nodes.coaching_cues_migration_status` text column with DB CHECK constraint.
 */
export type CoachingCuesMigrationStatus = "pending" | "in_progress" | "confirmed";

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
export type CameraAngleStatus = "primary" | "supported" | "not_supported";

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
  status?: CameraAngleStatus;
  reference_object_name: string;
  known_size_yards: number | null;
  known_size_unit?: string;
  placement_instructions: string;
  pixels_per_yard: number | null;
  filming_instructions?: string;
  calibration_notes?: string;
}

export interface ScoreBands {
  elite: string;
  varsity: string;
  developing: string;
  needs_work: string;
}

export type PerformanceMode = "performance" | "balanced" | "lightweight";

export type PoseEngine = "mediapipe" | "rtmlib";

export interface TrainingNode {
  id: string;
  /**
   * Pose estimation engine used for analysis. Defaults to "mediapipe" when not set.
   * Read sites should use `node.pose_engine ?? "mediapipe"`.
   * Phase 0: TypeScript-only, no DB column.
   */
  pose_engine?: PoseEngine;
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
  
  llm_max_words: number;
  llm_system_instructions: string;
  /** Phase 1c.1 — controls how phase_breakdown is rendered into the {{phase_context}} template variable. */
  phase_context_mode?: "off" | "names_only" | "compact" | "full";
  /** Phase 1c.1 Slice 2 — lifecycle for the Mechanics → Phases coaching cues migration. */
  coaching_cues_migration_status?: CoachingCuesMigrationStatus;
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
  skill_specific_filming_notes?: string;
  reference_fallback_behavior: ReferenceFallback;
  performance_mode: PerformanceMode;
  det_frequency: number;
  det_frequency_solo: number;
  det_frequency_defender: number;
  det_frequency_multiple: number;
  scoring_renormalize_on_skip: boolean;
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
    calibration_source?: string;
    pixels_per_yard?: number;
    processing_time_ms?: number;
    person_detected?: boolean;
    average_keypoint_confidence?: number;
    reliable_frame_percentage?: number;
    most_common_issue?: string;
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
  /**
   * Snapshot of the scoring config that was actually applied to this run.
   * Mirrors `PipelineLogData['scoring_config']` in the analyze-athlete-video
   * edge function. Surfaced in AnalysisLog Section 0 so admins can verify the
   * node's configured values were honored. Absence indicates missing
   * observability (treated as WARN), not silent success.
   */
  scoring_config?: {
    confidence_handling: "skip" | "penalize" | "flag_only";
    min_metrics_threshold: number;
    renormalize_on_skip: boolean;
    total_metrics: number;
    scored_count: number;
    flagged_count: number;
    skipped_count: number;
    skipped_percent: number;
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
    skipped_reason?: string;
    status?: "COMPLETE" | "FAILED" | "SKIPPED";
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

export type PipelineUploadStatus = "pending" | "processing" | "complete" | "failed" | "cancelled";

export type PipelineRunStage =
  | "idle"
  | "preparing_video"
  | "uploading"
  | "queued"
  | "processing"
  | "fetching_results"
  | "complete"
  | "cancelled"
  | "failed"
  | "timed_out";

export type PipelineMetricStatus = "scored" | "flagged" | "skipped" | "failed";

export interface PipelinePhaseScore {
  id: string;
  name: string;
  score: number;
}

export interface PipelineConfidenceFlag {
  metric: string;
  reason: string;
  [key: string]: unknown;
}

export interface PipelineMetricResult {
  name: string;
  unit: string;
  value: number | null;
  elite_target: string;
  tolerance?: number | null;
  deviation?: number | null;
  score?: number | null;
  weight: number;
  status: PipelineMetricStatus;
  reason?: string;
  detail?: Record<string, unknown>;
  phase_id?: string | null;
  phase_name?: string | null;
  calculation_type?: string | null;
}

export interface PipelineUploadSnapshot {
  id: string;
  status: PipelineUploadStatus;
  error_message: string | null;
  progress_message: string | null;
  created_at: string | null;
  video_url: string | null;
  node_id: string | null;
  node_version: number | null;
  camera_angle: string | null;
  start_seconds: number | null;
  end_seconds: number | null;
  analysis_context: Record<string, unknown>;
}

export interface PipelineAnalysisResult {
  uploadId: string;
  resultId: string | null;
  uploadStatus: PipelineUploadStatus;
  aggregateScore: number | null;
  phaseScores: Record<string, number>;
  phaseBreakdown: PipelinePhaseScore[];
  metricResults: PipelineMetricResult[];
  confidenceFlags: PipelineConfidenceFlag[];
  detectedErrors: Array<Record<string, unknown>>;
  feedback: string;
  analyzedAt: string | null;
  errorMessage: string | null;
  log_data?: AnalysisLogData;
}

export type AdminHistoryDateRange = "today" | "last_7_days" | "all";

export type AdminHistoryCalibrationFilter = "all" | "dynamic" | "body_based" | "static" | "none";

export type AdminHistoryStatusFilter = "all" | "complete" | "failed" | "cancelled";

export type AdminHistorySortOption = "date_desc" | "date_asc" | "score_asc" | "score_desc" | "node_name_asc";

export interface AdminHistoryCalibrationSummary {
  source: string | null;
  normalizedSource: Exclude<AdminHistoryCalibrationFilter, "all">;
  confidence: number | string | null;
  pixelsPerYard: number | null;
  rawPixelValue: number | null;
  details: Record<string, unknown> | null;
}

export interface AdminHistoryContextSnapshot {
  athleteHeightText: string | null;
  athleteWingspanText: string | null;
  cameraAngle: string | null;
  routeDirection: string | null;
  raw: Record<string, unknown>;
}

export interface AdminHistoryRecord {
  uploadId: string;
  resultId: string | null;
  nodeId: string | null;
  nodeName: string;
  nodeVersion: number | null;
  status: PipelineUploadStatus;
  errorMessage: string | null;
  uploadCreatedAt: string | null;
  analyzedAt: string | null;
  videoUrl: string | null;
  videoIdentifier: string;
  aggregateScore: number | null;
  phaseScores: Record<string, number>;
  phaseBreakdown: PipelinePhaseScore[];
  metricResults: PipelineMetricResult[];
  confidenceFlags: PipelineConfidenceFlag[];
  detectedErrors: Array<Record<string, unknown>>;
  feedback: string;
  calibration: AdminHistoryCalibrationSummary | null;
  analysisContext: AdminHistoryContextSnapshot;
}
