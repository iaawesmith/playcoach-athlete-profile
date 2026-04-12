export type CalculationType = "angle" | "distance" | "velocity" | "acceleration" | "frame_delta";
export type BilateralMode = "auto" | "left" | "right";

export interface KeypointMapping {
  body_groups: string[];
  keypoint_indices: number[];
  calculation_type: CalculationType | null;
  bilateral: BilateralMode;
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

export interface MechanicsSection {
  id: string;
  phase_id: string | null;
  content: string;
}

export interface Badge {
  name: string;
  condition: string;
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
  form_checkpoints: string[];
  llm_prompt_template: string;
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
}
