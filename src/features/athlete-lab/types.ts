export interface KeyMetric {
  name: string;
  description: string;
  eliteTarget: string;
  unit: string;
  weight: number;
}

export interface CommonError {
  error: string;
  correction: string;
}

export interface PhaseNote {
  phase: string;
  notes: string;
}

export interface Badge {
  name: string;
  condition: string;
}

export interface EliteVideo {
  url: string;
  label: string;
}

export interface TrainingNode {
  id: string;
  name: string;
  icon_url: string | null;
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
