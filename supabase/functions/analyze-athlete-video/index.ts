import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeHeightCalibration,
  windowScale,
  parseResolutionHeight,
  STATIC_ASSUMED_HEIGHT_PX,
  DEPTH_MOTION_THRESHOLD,
  type HeightCalibration,
} from './calibration.ts'
import {
  DEFAULT_MIN_PASS_RATIO,
  buildLowQualityFeedback,
  checkPlausibility,
  evaluateErrorRules,
  median,
  passesWindowGate,
} from './quality.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RTMLIB_FALLBACK =
  'https://rtmlib-service-874407535869.us-central1.run.app'

const MAX_CLIP_WINDOW_SECONDS = 3

// Fallback temporal windows used by calculateAllMetrics when a mapping omits one.
const DEFAULT_TEMPORAL_WINDOW: Record<string, number> = { velocity: 3, acceleration: 5, frame_delta: 10, distance_variance: 10 }

type JsonRecord = Record<string, unknown>
type Point = [number, number]
type PersonKeypoints = Point[]
type KeypointFrames = PersonKeypoints[]
type VideoKeypoints = KeypointFrames[]
type PersonScores = number[]
type ScoreFrames = PersonScores[]
type VideoScores = ScoreFrames[]

type MetricValueResult = {
  value: number | null
  reason?: string
  status?: 'skipped'
  detail?: JsonRecord
}

type CalibrationLike = JsonRecord & {
  camera_angle?: string | null
  pixels_per_yard?: number | null
  pixelsPerYard?: number | null
}

type ReferenceFallbackBehavior = 'pixel_warning' | 'disable_distance'

type ResolvedCalibration = {
  pixelsPerYard: number | null
  source: 'dynamic' | 'height_based' | 'body_based' | 'static' | 'none'
  // Smoothed per-frame px/yd series (height_based per-frame mode only).
  perFrame?: number[] | null
  confidence: number
  reason: string
  details: JsonRecord
}

// Slice C.5 — interim calibration observability.
// Captures BOTH calibration candidates (body_based + static) on every analysis,
// regardless of which path is selected, so cross-clip ground-truth comparison
// becomes possible without re-running historical uploads.
// Determinism contract: every field below must be a deterministic function of
// the analysis inputs. No timestamps, no random IDs, no Date.now(), no Math.random().
type BodyBasedAuditStatus =
  | 'used'
  | 'computed_but_not_selected'
  | 'unusable_low_confidence'
  | 'unusable_no_value'
  | 'not_attempted_no_athlete_height'

type StaticAuditStatus =
  | 'used'
  | 'computed_but_not_selected'
  | 'unusable_no_value'

type DynamicAuditStatus =
  | 'used'
  | 'failed'

type CalibrationAudit = {
  selected_source: 'dynamic' | 'height_based' | 'body_based' | 'static' | 'none'
  selected_ppy: number | null
  selected_mode: 'per_frame' | 'single' | null
  selection_rule: string
  candidates: JsonRecord[]
  rejected_reasons: Record<string, string>
  per_frame_scale: JsonRecord | null
  flags: JsonRecord[]
  dynamic_status: DynamicAuditStatus
  dynamic_failure_reason: string | null
  body_based_status: BodyBasedAuditStatus
  body_based_ppy: number | null
  body_based_confidence: number | null
  static_status: StaticAuditStatus
  static_ppy: number | null
  camera_angle: string
  athlete_height_provided: boolean
  node_id: string
  node_version: number
}

type CalibrationResolutionOutcome = {
  resolved: ResolvedCalibration
  audit: CalibrationAudit
}

type CloudRunCalibrationInput = JsonRecord & {
  pixelsPerYard?: number | null
  pixels_per_yard?: number | null
  calibrationConfidence?: string | null
  calibration_confidence?: string | null
  calibration_source?: string | null
  calibrationSource?: string | null
  calibration_details?: JsonRecord | null
  calibrationDetails?: JsonRecord | null
  calibration_flag?: string | null
  calibrationFlag?: string | null
  good_line_pairs?: number | null
  goodLinePairs?: number | null
  rejection_reason?: string | null
  rejectionReason?: string | null
}

type AthleteHeightMeasurement = {
  value: number
  unit: 'inches' | 'cm'
}

type BodyBasedCalibrationResult = {
  pixelsPerYard: number | null
  confidence: number
  source: 'body_based'
  method: string
  details: {
    hipWidthPixels: number
    shoulderWidthPixels: number
    framesUsed: number
    expectedHipWidthYards: number
    expectedShoulderWidthYards: number
  }
}

type BodyMeasurementSample = {
  frameIndex: number
  hipWidthPixels: number | null
  shoulderWidthPixels: number | null
  hipPixelsPerYard: number | null
  shoulderPixelsPerYard: number | null
  averageConfidence: number
}

type ConfidenceDiagnostics = {
  total_frames_in_window: number
  total_keypoint_checks: number
  passed_checks: number
  pass_ratio: number
  threshold: number
  confidence_threshold: number
  per_keypoint_avg_confidence: Record<string, number>
  lowest_confidence_keypoint: number | null
  frames_with_missing_keypoints: number
}

type ConfidenceCheckResult = {
  passed: boolean
  diagnostics: ConfidenceDiagnostics
}

type BilateralSide = 'left' | 'right'

type BilateralDecisionSource = 'override' | 'fixed_bilateral' | 'route_direction' | 'confidence_auto'

type BilateralMappingInput = {
  bilateral?: string | null
  bilateral_override?: string | null
  keypoint_indices?: number[] | null
  side_rule?: string | null
  calculation_type?: string | null
}

type BilateralDecision = {
  side: BilateralSide
  source: BilateralDecisionSource
  baseIndices: number[]
  leftIndices: number[]
  rightIndices: number[]
  effectiveIndices: number[]
  leftAverageConfidence: number | null
  rightAverageConfidence: number | null
  side_rule?: SideRule
  side_rule_source?: SideRuleSource
}

const MIRROR_INDEX_BY_INDEX = buildMirrorIndexMap()

// Diagnostic-export build tag. Bump when the additive result_data.diagnostics
// payload changes shape so exports can be traced back to the analyzer build.
const ANALYZER_BUILD = '2026-10-21.diagnostic-export.1'

type PipelineCancellationError = Error & { code: 'UPLOAD_CANCELLED' }

type UploadLike = {
  id: string
  athlete_id: string
  node_id: string
  node_version: number
  video_url: string
  start_seconds: number
  end_seconds: number
  camera_angle?: string | null
  analysis_context?: JsonRecord
}

type CloudRunProgressUpdate = {
  message?: string
  frame?: number
  total_frames?: number
  detection_every_n?: number
}

type CloudRunResponse = {
  keypoints: VideoKeypoints
  scores: VideoScores
  frame_count: number
  fps: number
  pixelsPerYard?: number | null
  pixels_per_yard?: number | null
  calibrationConfidence?: string | null
  calibration_confidence?: string | null
  calibration_source?: string | null
  calibrationSource?: string | null
  calibration_details?: JsonRecord | null
  calibrationDetails?: JsonRecord | null
  calibration_flag?: string | null
  calibrationFlag?: string | null
  good_line_pairs?: number | null
  goodLinePairs?: number | null
  rejection_reason?: string | null
  rejectionReason?: string | null
  progress_updates?: CloudRunProgressUpdate[]
  auto_zoom_applied?: boolean | null
  autoZoomApplied?: boolean | null
  auto_zoom_reason?: string | null
  autoZoomReason?: string | null
  auto_zoom_factor?: number | null
  autoZoomFactor?: number | null
  auto_zoom_final_fill_ratio?: number | null
  autoZoomFinalFillRatio?: number | null
  auto_zoom_crop_rect?: JsonRecord | null
  autoZoomCropRect?: JsonRecord | null
  auto_zoom_padding?: JsonRecord | null
  autoZoomPadding?: JsonRecord | null
  movement_direction?: string | null
  movementDirection?: string | null
  movement_confidence?: number | null
  movementConfidence?: number | null
  person_detection_confidence?: number | null
  personDetectionConfidence?: number | null
  safety_backoff_applied?: boolean | null
  safetyBackoffApplied?: boolean | null
  athlete_framing_message?: string | null
  athleteFramingMessage?: string | null
  mean_keypoint_confidence_before_auto_zoom?: number | null
  meanKeypointConfidenceBeforeAutoZoom?: number | null
  mean_keypoint_confidence_after_auto_zoom?: number | null
  meanKeypointConfidenceAfterAutoZoom?: number | null
  // F-POSE-1 frame diagnostics (additive; absent on older service revisions)
  frames_detected?: number | null
  missed_frame_indices?: number[] | null
  recovered_frame_indices?: number[] | null
  det_frequency_used?: number | null
  frame_width?: number | null
  frame_height?: number | null
}

type CloudRunMetadata = {
  auto_zoom_applied?: boolean
  auto_zoom_reason?: string
  auto_zoom_factor?: number
  auto_zoom_final_fill_ratio?: number
  auto_zoom_crop_rect?: JsonRecord
  auto_zoom_padding?: JsonRecord
  movement_direction?: string
  movement_confidence?: number
  person_detection_confidence?: number
  safety_backoff_applied?: boolean
  athlete_framing_message?: string
  mean_keypoint_confidence_before_auto_zoom?: number
  mean_keypoint_confidence_after_auto_zoom?: number
  calibration_source?: string
  calibration_confidence?: string
  calibration_details?: JsonRecord
  calibration_flag?: string
  rejection_reason?: string
  good_line_pairs?: number
  pixels_per_yard?: number
}

type PipelineLogData = {
  timestamp?: string
  preflight: {
    checks: Array<{
      name: string
      expected: string
      actual: string
      result: 'PASS' | 'WARN' | 'FAIL'
    }>
    pipeline_stopped?: boolean
    stop_reason?: string
  }
  rtmlib?: {
    model?: string
    backend?: string
    total_frames?: number
    source_fps?: number
    calibration_source?: string
    pixels_per_yard?: number
    processing_time_ms?: number
    person_detected?: boolean
    average_keypoint_confidence?: number
    reliable_frame_percentage?: number
    most_common_issue?: string
    phase_windows?: Array<{
      phase: string
      start: number
      end: number
      frame_count: number
      percent: number
    }>
    keypoint_confidence?: Array<{
      index: number
      name: string
      mean_confidence: number
      min_confidence: number
      min_frame: number
      frames_below: number
      total_frames: number
      percent_below: number
      status: 'RELIABLE' | 'MARGINAL' | 'UNRELIABLE'
    }>
    auto_zoom_applied?: boolean
    auto_zoom_reason?: string
    auto_zoom_factor?: number
    auto_zoom_final_fill_ratio?: number
    auto_zoom_crop_rect?: JsonRecord
    auto_zoom_padding?: JsonRecord
    movement_direction?: string
    movement_confidence?: number
    person_detection_confidence?: number
    safety_backoff_applied?: boolean
    athlete_framing_message?: string
    mean_keypoint_confidence_before_auto_zoom?: number
    mean_keypoint_confidence_after_auto_zoom?: number
    calibration_confidence?: string
    calibration_details?: JsonRecord
    calibration_flag?: string
    rejection_reason?: string
    good_line_pairs?: number
  }
  metrics?: Array<{
    name: string
    weight: number
    phase: string
    frames_evaluated: number
    frame_range: string
    keypoints: string
    calculation_type: string
    temporal_window: number
    extracted_values?: string
    calculated_result: string
    unit: string
    elite_target: string
    deviation: string
    raw_score: number
    weighted_contribution: string
    status: 'SCORED' | 'SKIPPED' | 'FLAGGED'
    skip_reason?: string
  }>
  aggregate?: {
    mastery_score: number
    confidence_adjusted: boolean
    metrics_skipped: number
    metrics_total: number
  }
  scoring_config?: {
    confidence_handling: 'skip' | 'penalize' | 'flag_only'
    min_metrics_threshold: number
    renormalize_on_skip: boolean
    total_metrics: number
    scored_count: number
    flagged_count: number
    skipped_count: number
    skipped_percent: number
  }
  error_detection?: Array<{
    name: string
    auto_detectable: boolean
    condition: string
    metric_value: string
    evaluation_expression: string
    triggered: boolean
  }>
  claude_api?: {
    model?: string
    system_instructions_present?: boolean
    system_instructions_chars?: number
    variables_injected?: Array<{ name: string; value_summary: string; present: boolean }>
    missing_variables?: string[]
    prompt_tokens?: number
    system_tokens?: number
    template_tokens?: number
    variable_tokens?: number
    response_tokens?: number
    total_tokens?: number
    word_count?: number
    target_words?: number
    truncated?: boolean
    skipped_reason?: string
    status?: 'COMPLETE' | 'FAILED' | 'SKIPPED'
  }
}

type ClaudeCallResult = {
  feedback: string
  log: PipelineLogData['claude_api']
  // Full-fidelity record for the diagnostic export (exact prompt/response).
  diagnostics: {
    model: string
    status: 'COMPLETE' | 'FAILED' | 'SKIPPED'
    system_instructions: string | null
    prompt: string | null
    response: string | null
    input_tokens: number | null
    output_tokens: number | null
    skipped_reason: string | null
  }
}

type LlmDiagnostics = ClaudeCallResult['diagnostics']

type RunDiagnostics = {
  schema_version: 1
  analyzer_build: string
  deployment_id: string | null
  cloud_run_revision: string | null
  service: JsonRecord
  per_frame: JsonRecord[]
  metrics: JsonRecord[]
  errors: JsonRecord
  aggregate: JsonRecord
  llm: LlmDiagnostics
  fingerprints: {
    keypoints_sha256: string
    metric_results_sha256: string
    calibration_audit_sha256: string
  }
  raw_keypoints: VideoKeypoints
  raw_scores: VideoScores
}

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Builds the additive result_data.diagnostics payload. Pure reporting: every
 * field is derived from values already computed for this run; nothing here
 * feeds back into scoring, calibration, or feedback.
 */
async function buildRunDiagnostics(input: {
  rtmlibResult: CloudRunResponse
  detFrequency: number
  trackedKeypoints: VideoKeypoints
  trackedScores: VideoScores
  phaseWindows: Array<{ phase: string; start: number; end: number }>
  resolvedCalibration: ResolvedCalibration
  calibrationAudit: CalibrationAudit
  metricResults: any[]
  errorResults: any
  errorDetectionLog: unknown
  scoreResult: any
  llm: LlmDiagnostics
}): Promise<RunDiagnostics> {
  const {
    rtmlibResult,
    detFrequency,
    trackedKeypoints,
    trackedScores,
    phaseWindows,
    resolvedCalibration,
    calibrationAudit,
    metricResults,
    errorResults,
    errorDetectionLog,
    scoreResult,
    llm,
  } = input

  const heightCandidate = Array.isArray(calibrationAudit.candidates)
    ? calibrationAudit.candidates.find((c) => c?.source === 'height_based')
    : null
  const rawHeightSeries = heightCandidate && Array.isArray((heightCandidate as JsonRecord).raw_series)
    ? ((heightCandidate as JsonRecord).raw_series as Array<number | null>)
    : null
  const scaleSeries = Array.isArray(resolvedCalibration.perFrame) ? resolvedCalibration.perFrame : null

  const perFrame: JsonRecord[] = trackedKeypoints.map((frame, index) => {
    const person = frame?.[0]
    const personScores = trackedScores[index]?.[0]
    const detected = Array.isArray(person) && person.length > 0
    const meanConfidence = Array.isArray(personScores) && personScores.length > 0
      ? round3(personScores.reduce((sum, s) => sum + (typeof s === 'number' ? s : 0), 0) / personScores.length)
      : null
    let hipCenterX: number | null = null
    let hipCenterY: number | null = null
    if (detected && person[23] && person[24]) {
      hipCenterX = round3((person[23][0] + person[24][0]) / 2)
      hipCenterY = round3((person[23][1] + person[24][1]) / 2)
    }
    const heightPx = rawHeightSeries && typeof rawHeightSeries[index] === 'number' ? round3(rawHeightSeries[index] as number) : null
    const scalePpy = scaleSeries && typeof scaleSeries[index] === 'number'
      ? round3(scaleSeries[index])
      : resolvedCalibration.pixelsPerYard !== null
        ? round3(resolvedCalibration.pixelsPerYard)
        : null
    return {
      frame: index,
      detected,
      mean_confidence: meanConfidence,
      hip_center_x: hipCenterX,
      hip_center_y: hipCenterY,
      athlete_height_px: heightPx,
      scale_ppy: scalePpy,
      phases: phaseWindows.filter((w) => index >= w.start && index <= w.end).map((w) => w.phase),
    }
  })

  const service: JsonRecord = {
    frames_detected: rtmlibResult.frames_detected ?? null,
    missed_frame_indices: rtmlibResult.missed_frame_indices ?? null,
    recovered_frame_indices: rtmlibResult.recovered_frame_indices ?? null,
    det_frequency_used: rtmlibResult.det_frequency_used ?? detFrequency,
    frame_width: rtmlibResult.frame_width ?? null,
    frame_height: rtmlibResult.frame_height ?? null,
    frame_count: rtmlibResult.frame_count ?? null,
    fps: rtmlibResult.fps ?? null,
    pixels_per_yard: getPixelsPerYardValue(rtmlibResult),
    calibration_source: getCalibrationSourceLabel(rtmlibResult),
    calibration_confidence: getCalibrationConfidenceLabel(rtmlibResult),
    person_detection_confidence: rtmlibResult.person_detection_confidence ?? rtmlibResult.personDetectionConfidence ?? null,
    auto_zoom: {
      applied: rtmlibResult.auto_zoom_applied ?? rtmlibResult.autoZoomApplied ?? null,
      reason: rtmlibResult.auto_zoom_reason ?? rtmlibResult.autoZoomReason ?? null,
      factor: rtmlibResult.auto_zoom_factor ?? rtmlibResult.autoZoomFactor ?? null,
      final_fill_ratio: rtmlibResult.auto_zoom_final_fill_ratio ?? rtmlibResult.autoZoomFinalFillRatio ?? null,
      crop_rect: rtmlibResult.auto_zoom_crop_rect ?? rtmlibResult.autoZoomCropRect ?? null,
      padding: rtmlibResult.auto_zoom_padding ?? rtmlibResult.autoZoomPadding ?? null,
      safety_backoff_applied: rtmlibResult.safety_backoff_applied ?? rtmlibResult.safetyBackoffApplied ?? null,
      mean_keypoint_confidence_before: rtmlibResult.mean_keypoint_confidence_before_auto_zoom ?? rtmlibResult.meanKeypointConfidenceBeforeAutoZoom ?? null,
      mean_keypoint_confidence_after: rtmlibResult.mean_keypoint_confidence_after_auto_zoom ?? rtmlibResult.meanKeypointConfidenceAfterAutoZoom ?? null,
    },
    // The pose service logs per-stage timings but does not return them.
    timings: null,
  }

  const [keypointsHash, metricsHash, calibrationHash] = await Promise.all([
    sha256Hex(trackedKeypoints),
    sha256Hex(metricResults),
    sha256Hex(calibrationAudit),
  ])

  return {
    schema_version: 1,
    analyzer_build: ANALYZER_BUILD,
    deployment_id: Deno.env.get('DENO_DEPLOYMENT_ID') ?? null,
    cloud_run_revision: Deno.env.get('K_REVISION') ?? null,
    service,
    per_frame: perFrame,
    metrics: metricResults.map((m) => ({ ...m })),
    errors: {
      evaluations: errorDetectionLog ?? [],
      detected: errorResults?.detected ?? [],
    },
    aggregate: {
      aggregate_score: scoreResult?.aggregate_score ?? null,
      phase_scores: scoreResult?.phase_scores ?? {},
      rejected: scoreResult?.rejected ?? false,
      rejected_reason: scoreResult?.reason ?? null,
      scoring_config_applied: scoreResult?.scoring_config_applied ?? null,
      scored_count: metricResults.filter((m) => m.status === 'scored').length,
      flagged_count: metricResults.filter((m) => m.status === 'flagged').length,
      skipped_count: metricResults.filter((m) => m.status === 'skipped').length,
    },
    llm,
    fingerprints: {
      keypoints_sha256: keypointsHash,
      metric_results_sha256: metricsHash,
      calibration_audit_sha256: calibrationHash,
    },
    raw_keypoints: trackedKeypoints,
    raw_scores: trackedScores,
  }
}

type PoseQualityAudit = {
  personDetected: boolean
  averageKeypointConfidence: number
  reliableFramePercentage: number
  mostCommonIssue: string
  usableData: boolean
  passedMetricCount: number
  lowConfidenceMetricCount: number
}

function createCancellationError(uploadId: string): PipelineCancellationError {
  const error = new Error(`Upload ${uploadId} was cancelled`) as PipelineCancellationError
  error.code = 'UPLOAD_CANCELLED'
  return error
}

function logInfo(event: string, details: JsonRecord = {}) {
  console.info(JSON.stringify({ level: 'info', event, ...details }))
}

function logWarn(event: string, details: JsonRecord = {}) {
  console.warn(JSON.stringify({ level: 'warn', event, ...details }))
}

function buildProgressMessage(message: string, details: JsonRecord = {}): string {
  const frame = typeof details.frame === 'number' && Number.isFinite(details.frame) ? details.frame : null
  const totalFrames = typeof details.totalFrames === 'number' && Number.isFinite(details.totalFrames) ? details.totalFrames : null
  const detectionEveryN = typeof details.detectionEveryN === 'number' && Number.isFinite(details.detectionEveryN) ? details.detectionEveryN : null

  if (frame !== null && totalFrames !== null && detectionEveryN !== null) {
    return `${message} (${Math.round(frame)}/${Math.round(totalFrames)} · detection every ${Math.round(detectionEveryN)} frames)`
  }

  return message
}

function summarizePersonCount(keypoints: VideoKeypoints): { firstFrame: number; maxAcrossFrames: number } {
  const firstFrame = keypoints[0]?.length || 0
  const maxAcrossFrames = keypoints.reduce((maxCount, frame) => {
    return Math.max(maxCount, frame?.length || 0)
  }, 0)

  return { firstFrame, maxAcrossFrames }
}

function readBooleanField(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value
  }
  return undefined
}

function readNumberField(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

function readStringField(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return undefined
}

function readJsonRecordField(...values: unknown[]): JsonRecord | undefined {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonRecord
  }
  return undefined
}

function buildCloudRunMetadata(result: CloudRunResponse): CloudRunMetadata {
  const metadata: CloudRunMetadata = {}

  const autoZoomApplied = readBooleanField(result.auto_zoom_applied, result.autoZoomApplied)
  if (autoZoomApplied !== undefined) metadata.auto_zoom_applied = autoZoomApplied

  const autoZoomReason = readStringField(result.auto_zoom_reason, result.autoZoomReason)
  if (autoZoomReason !== undefined) metadata.auto_zoom_reason = autoZoomReason

  const autoZoomFactor = readNumberField(result.auto_zoom_factor, result.autoZoomFactor)
  if (autoZoomFactor !== undefined) metadata.auto_zoom_factor = autoZoomFactor

  const autoZoomFinalFillRatio = readNumberField(result.auto_zoom_final_fill_ratio, result.autoZoomFinalFillRatio)
  if (autoZoomFinalFillRatio !== undefined) metadata.auto_zoom_final_fill_ratio = autoZoomFinalFillRatio

  const autoZoomCropRect = readJsonRecordField(result.auto_zoom_crop_rect, result.autoZoomCropRect)
  if (autoZoomCropRect !== undefined) metadata.auto_zoom_crop_rect = autoZoomCropRect

  const autoZoomPadding = readJsonRecordField(result.auto_zoom_padding, result.autoZoomPadding)
  if (autoZoomPadding !== undefined) metadata.auto_zoom_padding = autoZoomPadding

  const movementDirection = readStringField(result.movement_direction, result.movementDirection)
  if (movementDirection !== undefined) metadata.movement_direction = movementDirection

  const movementConfidence = readNumberField(result.movement_confidence, result.movementConfidence)
  if (movementConfidence !== undefined) metadata.movement_confidence = movementConfidence

  const personDetectionConfidence = readNumberField(result.person_detection_confidence, result.personDetectionConfidence)
  if (personDetectionConfidence !== undefined) metadata.person_detection_confidence = personDetectionConfidence

  const safetyBackoffApplied = readBooleanField(result.safety_backoff_applied, result.safetyBackoffApplied)
  if (safetyBackoffApplied !== undefined) metadata.safety_backoff_applied = safetyBackoffApplied

  const athleteFramingMessage = readStringField(result.athlete_framing_message, result.athleteFramingMessage)
  if (athleteFramingMessage !== undefined) metadata.athlete_framing_message = athleteFramingMessage

  const meanConfidenceBefore = readNumberField(
    result.mean_keypoint_confidence_before_auto_zoom,
    result.meanKeypointConfidenceBeforeAutoZoom,
  )
  if (meanConfidenceBefore !== undefined) metadata.mean_keypoint_confidence_before_auto_zoom = meanConfidenceBefore

  const meanConfidenceAfter = readNumberField(
    result.mean_keypoint_confidence_after_auto_zoom,
    result.meanKeypointConfidenceAfterAutoZoom,
  )
  if (meanConfidenceAfter !== undefined) metadata.mean_keypoint_confidence_after_auto_zoom = meanConfidenceAfter

  const calibrationSource = readStringField(result.calibration_source, result.calibrationSource)
  if (calibrationSource !== undefined) metadata.calibration_source = calibrationSource

  const calibrationConfidence = readStringField(result.calibration_confidence, result.calibrationConfidence)
  if (calibrationConfidence !== undefined) metadata.calibration_confidence = calibrationConfidence

  const calibrationDetails = readJsonRecordField(result.calibration_details, result.calibrationDetails)
  if (calibrationDetails !== undefined) metadata.calibration_details = calibrationDetails

  const calibrationFlag = readStringField(result.calibration_flag, result.calibrationFlag)
  if (calibrationFlag !== undefined) metadata.calibration_flag = calibrationFlag

  const rejectionReason = readStringField(result.rejection_reason, result.rejectionReason)
  if (rejectionReason !== undefined) metadata.rejection_reason = rejectionReason

  const goodLinePairs = readNumberField(result.good_line_pairs, result.goodLinePairs)
  if (goodLinePairs !== undefined) metadata.good_line_pairs = goodLinePairs

  const pixelsPerYard = getPixelsPerYardValue(result)
  if (pixelsPerYard !== null) metadata.pixels_per_yard = pixelsPerYard

  return metadata
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value))
}

type KeypointConfidenceEntry = {
  index: number
  name: string
  mean_confidence: number
  min_confidence: number
  min_frame: number
  frames_below: number
  total_frames: number
  percent_below: number
  status: 'RELIABLE' | 'MARGINAL' | 'UNRELIABLE'
}

function buildPoseQualityAudit(
  personCountSummary: { firstFrame: number; maxAcrossFrames: number },
  keypointConfidence: KeypointConfidenceEntry[] | undefined,
  metricResults: any[],
  aggregateScore: number | null | undefined,
): PoseQualityAudit {
  const confidenceEntries = Array.isArray(keypointConfidence) ? keypointConfidence : []
  const averageKeypointConfidence = confidenceEntries.length > 0
    ? Number((confidenceEntries.reduce((sum, entry) => sum + entry.mean_confidence, 0) / confidenceEntries.length).toFixed(2))
    : 0

  const reliableFramePercentage = confidenceEntries.length > 0
    ? Number((100 - (confidenceEntries.reduce((sum, entry) => sum + entry.percent_below, 0) / confidenceEntries.length)).toFixed(1))
    : 0

  const scoredMetrics = metricResults.filter((metric) => metric?.status === 'scored')
  const flaggedMetrics = metricResults.filter((metric) => metric?.status === 'flagged')
  const lowConfidenceMetricCount = flaggedMetrics.filter((metric) => typeof metric?.reason === 'string' && metric.reason.includes('confidence')).length
  const passedMetricCount = scoredMetrics.length
  const personDetected = personCountSummary.maxAcrossFrames > 0
  const usableData = (typeof aggregateScore === 'number' && aggregateScore > 0) || passedMetricCount >= 2

  let mostCommonIssue = 'Body not fully visible'
  if (!personDetected) {
    mostCommonIssue = 'No person detected in frame'
  } else if (averageKeypointConfidence < 0.35 || reliableFramePercentage < 30) {
    mostCommonIssue = 'Athlete too small / too far in frame'
  } else if (averageKeypointConfidence < 0.45 || reliableFramePercentage < 45) {
    mostCommonIssue = 'Motion blur'
  }

  if (confidenceEntries.some((entry) => entry.index <= 16 && entry.status === 'UNRELIABLE') && reliableFramePercentage < 40) {
    mostCommonIssue = 'Body not fully visible'
  }

  if (lowConfidenceMetricCount >= Math.max(2, Math.ceil(metricResults.length * 0.6))) {
    mostCommonIssue = averageKeypointConfidence < 0.4
      ? 'Athlete too small / too far in frame'
      : mostCommonIssue
  }

  return {
    personDetected,
    averageKeypointConfidence,
    reliableFramePercentage: clampPercentage(reliableFramePercentage),
    mostCommonIssue,
    usableData,
    passedMetricCount,
    lowConfidenceMetricCount,
  }
}

Deno.serve(async (req) => {
  let uploadId: string | null = null

  try {
    const payload = await req.json()
    const upload = payload.record
    if (!upload?.id) {
      throw new Error('Invalid webhook payload: missing record.id')
    }
    uploadId = upload.id

    logInfo('pipeline_started', {
      uploadId,
      nodeId: upload.node_id,
      athleteId: upload.athlete_id,
      videoUrlPresent: Boolean(upload.video_url),
      startSeconds: upload.start_seconds,
      endSeconds: upload.end_seconds,
    })

    const logData: PipelineLogData = {
      timestamp: new Date().toISOString(),
      preflight: { checks: [] },
    }

    // Update status to processing immediately
    await updateUploadStatus(upload.id, 'processing', undefined, 'Loading model on server...')
    await ensureNotCancelled(upload.id)

    // STEP 1: Fetch full node config
    await setUploadProgress(upload.id, 'Loading analysis node configuration...')
    const nodeConfig = await fetchNodeConfig(upload.node_id)
    logInfo('node_config_loaded', {
      uploadId,
      nodeId: nodeConfig.id,
      nodeName: nodeConfig.name,
      nodeVersion: nodeConfig.node_version,
      metricCount: Array.isArray(nodeConfig.key_metrics) ? nodeConfig.key_metrics.length : 0,
      phaseCount: Array.isArray(nodeConfig.phase_breakdown) ? nodeConfig.phase_breakdown.length : 0,
    })

    // STEP 2: Pre-flight validation
    await setUploadProgress(upload.id, 'Validating clip window and pipeline settings...')
    const preflightResult = await runPreflight(upload, nodeConfig)
    logData.preflight = {
      checks: preflightResult.checks,
      pipeline_stopped: !preflightResult.passed,
      stop_reason: preflightResult.passed ? undefined : preflightResult.reason,
    }
    if (!preflightResult.passed) {
      logWarn('preflight_failed', { uploadId, reason: preflightResult.reason })
      await updateUploadStatus(upload.id, 'failed', preflightResult.reason)
      return new Response(JSON.stringify({ error: preflightResult.reason }), { status: 400 })
    }
    logInfo('preflight_passed', { uploadId })
    await ensureNotCancelled(upload.id)

    // STEP 3: Select analysis context settings
    await setUploadProgress(upload.id, 'Preparing route analysis context...')
    const context = upload.analysis_context || {}
    const detFrequencySelection = resolveDetectionFrequency(nodeConfig, context)
    const detFrequency = detFrequencySelection.value
    const staticCalibration = selectCalibration(nodeConfig, context.camera_angle || upload.camera_angle)
    logInfo('analysis_context_selected', {
      uploadId,
      peopleInVideo: context.people_in_video || 'unknown',
      routeDirection: context.route_direction || 'unknown',
      cameraAngle: context.camera_angle || upload.camera_angle || 'unknown',
      catchIncluded: context.catch_included !== false,
      detFrequency,
      hasCalibration: Boolean(staticCalibration),
      pixelsPerYard: staticCalibration?.pixels_per_yard ?? null,
    })
    logInfo('detection_frequency_selected', {
      uploadId,
      scenario: detFrequencySelection.scenario,
      baseScenarioValue: detFrequencySelection.baseValue,
      breakOverrideValue: detFrequencySelection.breakOverrideValue,
      breakOverrideApplied: detFrequencySelection.breakOverrideApplied,
      detFrequency,
      message: `Detection frequency set to ${detFrequency} for this run (${detFrequencySelection.scenario})`,
    })

    // STEP 4: Call Cloud Run rtmlib service with the uploaded video URL
    await setUploadProgress(upload.id, 'Loading model on server...')
    await ensureNotCancelled(upload.id)
    const rtmlibResult = await callCloudRun({
      uploadId: upload.id,
      video_url: upload.video_url,
      start_seconds: upload.start_seconds,
      end_seconds: upload.end_seconds,
      det_frequency: detFrequency,
    })
    const cloudRunMetadata = buildCloudRunMetadata(rtmlibResult)
    logData.rtmlib = {
      backend: 'cloud_run',
      total_frames: rtmlibResult.frame_count,
      source_fps: rtmlibResult.fps,
      keypoint_confidence: summarizeKeypointConfidence(rtmlibResult.scores),
      calibration_source: getCalibrationSourceLabel(rtmlibResult) ?? undefined,
      pixels_per_yard: getPixelsPerYardValue(rtmlibResult) ?? undefined,
      ...(Object.keys(cloudRunMetadata).length > 0 ? cloudRunMetadata : {}),
    }
    const personCountSummary = summarizePersonCount(rtmlibResult.keypoints)
    logInfo('cloud_run_response_received', {
      uploadId,
      frameCount: rtmlibResult.frame_count,
      fps: rtmlibResult.fps,
      firstFramePersonCount: personCountSummary.firstFrame,
      maxFramePersonCount: personCountSummary.maxAcrossFrames,
      calibrationSource: getCalibrationSourceLabel(rtmlibResult),
      pixelsPerYard: getPixelsPerYardValue(rtmlibResult),
      goodLinePairs: getGoodLinePairsValue(rtmlibResult),
    })
    await ensureNotCancelled(upload.id)

    // STEP 5: Apply temporal smoothing to keypoints
    await setUploadProgress(upload.id, 'Applying temporal smoothing to tracked keypoints...')
    const smoothedKeypoints = applyTemporalSmoothing(rtmlibResult.keypoints, rtmlibResult.scores, nodeConfig)
    const smoothedScores = rtmlibResult.scores

    // STEP 6: Lock onto target person
    await setUploadProgress(upload.id, 'Locking onto the athlete in frame...')
    const targetPersonIndex = lockTargetPerson(
      smoothedKeypoints,
      context.people_in_video
    )
    logInfo('target_person_locked', {
      uploadId,
      targetPersonIndex,
      peopleInVideo: context.people_in_video || 'unknown',
    })

    const trackedPersonFrames = isolateTrackedPersonFrames(
      smoothedKeypoints,
      smoothedScores,
      targetPersonIndex
    )

    await setUploadProgress(upload.id, 'Running dynamic calibration...')
    const serviceFrame = rtmlibResult as unknown as { frame_width?: unknown; frame_height?: unknown }
    const serviceHeight = typeof serviceFrame.frame_height === 'number' && serviceFrame.frame_height > 0
      ? Math.min(serviceFrame.frame_height, typeof serviceFrame.frame_width === 'number' && serviceFrame.frame_width > 0 ? serviceFrame.frame_width : serviceFrame.frame_height)
      : null
    const resolutionHeight = serviceHeight ?? await lookupClipResolutionHeight(context)
    const { resolved: resolvedCalibration, audit: calibrationAudit } = resolveCalibration(
      rtmlibResult,
      trackedPersonFrames.keypoints,
      trackedPersonFrames.scores,
      getAthleteHeightMeasurement(context),
      nodeConfig,
      context.camera_angle || upload.camera_angle || '',
      resolutionHeight,
    )

    // STEP 7: Divide frames into phase windows
    await setUploadProgress(upload.id, 'Segmenting the rep into route phases...')
    const phaseWindows = calculatePhaseWindows(
      rtmlibResult.frame_count,
      nodeConfig.phase_breakdown,
      3,
    )
    if (logData.rtmlib) {
      logData.rtmlib.phase_windows = buildPhaseWindowLog(
        phaseWindows,
        nodeConfig.phase_breakdown,
        rtmlibResult.frame_count,
      )
    }

    // STEP 8: Calculate all metrics
    await setUploadProgress(upload.id, 'Calculating metrics...')
    const metricResults = await calculateAllMetrics(
      nodeConfig.key_metrics,
      smoothedKeypoints,
      smoothedScores,
      phaseWindows,
      targetPersonIndex,
      resolvedCalibration,
      (nodeConfig.reference_fallback_behavior as ReferenceFallbackBehavior | undefined) || 'pixel_warning',
      context,
      rtmlibResult.fps,
      uploadId
    )
    logInfo('metric_calculation_complete', {
      uploadId,
      totalMetrics: metricResults.length,
      scored: metricResults.filter((metric) => metric.status === 'scored').length,
      flagged: metricResults.filter((metric) => metric.status === 'flagged').length,
      skipped: metricResults.filter((metric) => metric.status === 'skipped').length,
      failed: metricResults.filter((metric) => metric.status === 'failed').length,
    })
    await ensureNotCancelled(upload.id)

    // STEP 9: Calculate aggregate score
    await setUploadProgress(upload.id, 'Scoring the full rep...')
    const scoreResult = calculateAggregateScore(
      metricResults,
      nodeConfig,
      context.catch_included !== false
    )
    logData.metrics = buildMetricLogEntries(metricResults, phaseWindows, nodeConfig.phase_breakdown)
    logData.aggregate = {
      mastery_score: typeof scoreResult.aggregate_score === 'number' ? scoreResult.aggregate_score : 0,
      confidence_adjusted: metricResults.some((metric) => metric.status === 'flagged'),
      metrics_skipped: metricResults.filter((metric) => metric.status !== 'scored').length,
      metrics_total: metricResults.length,
    }
    if (scoreResult.scoring_config_applied) {
      logData.scoring_config = scoreResult.scoring_config_applied
    }
    const poseQualityAudit = buildPoseQualityAudit(
      personCountSummary,
      logData.rtmlib?.keypoint_confidence,
      metricResults,
      scoreResult.aggregate_score,
    )
    if (logData.rtmlib) {
      logData.rtmlib.person_detected = poseQualityAudit.personDetected
      logData.rtmlib.average_keypoint_confidence = poseQualityAudit.averageKeypointConfidence
      logData.rtmlib.reliable_frame_percentage = poseQualityAudit.reliableFramePercentage
      logData.rtmlib.most_common_issue = poseQualityAudit.mostCommonIssue
    }

    // STEP 10: Error auto-detection
    await setUploadProgress(upload.id, 'Checking for common route errors...')
    const errorResults = detectErrors(nodeConfig.common_errors, metricResults)
    logData.error_detection = buildErrorDetectionLog(nodeConfig.common_errors, metricResults, errorResults)

    // STEP 11: Call Claude API
    await ensureNotCancelled(upload.id)
    let feedback = 'Pose confidence was too low to generate coaching feedback. Please try a clearer video — stand 10–15 yards away, film perpendicular to your route, and make sure your full body stays in frame.'
    let llmDiagnostics: LlmDiagnostics
    if (scoreResult.rejected) {
      const phaseNames = new Map(parsePhaseBreakdown(nodeConfig.phase_breakdown).map((p) => [p.id, p.name]))
      const affected = metricResults
        .filter((m: any) => m.status !== 'scored')
        .map((m: any) => phaseNames.get(m.keypoint_mapping?.phase_id) ?? '')
      feedback = buildLowQualityFeedback(affected)
      logData.claude_api = {
        model: 'claude-sonnet-4-5',
        status: 'SKIPPED',
        skipped_reason: 'low_quality_clip',
        target_words: typeof nodeConfig.llm_max_words === 'number' ? nodeConfig.llm_max_words : undefined,
      }
      llmDiagnostics = {
        model: 'claude-sonnet-4-5',
        status: 'SKIPPED',
        system_instructions: typeof nodeConfig.llm_system_instructions === 'string' ? nodeConfig.llm_system_instructions : null,
        prompt: null,
        response: null,
        input_tokens: null,
        output_tokens: null,
        skipped_reason: 'low_quality_clip',
      }
      logInfo('claude_skipped_low_quality_clip', { uploadId, reason: scoreResult.reason })
    } else if (!poseQualityAudit.usableData) {
      logData.claude_api = {
        model: 'claude-sonnet-4-5',
        status: 'SKIPPED',
        skipped_reason: 'Pose confidence too low to generate reliable coaching feedback.',
        target_words: typeof nodeConfig.llm_max_words === 'number' ? nodeConfig.llm_max_words : undefined,
      }
      llmDiagnostics = {
        model: 'claude-sonnet-4-5',
        status: 'SKIPPED',
        system_instructions: typeof nodeConfig.llm_system_instructions === 'string' ? nodeConfig.llm_system_instructions : null,
        prompt: null,
        response: null,
        input_tokens: null,
        output_tokens: null,
        skipped_reason: 'pose_confidence_too_low',
      }
      logInfo('claude_skipped_low_confidence', {
        uploadId,
        aggregateScore: scoreResult.aggregate_score,
        passedMetricCount: poseQualityAudit.passedMetricCount,
        lowConfidenceMetricCount: poseQualityAudit.lowConfidenceMetricCount,
        averageKeypointConfidence: poseQualityAudit.averageKeypointConfidence,
        reliableFramePercentage: poseQualityAudit.reliableFramePercentage,
      })
    } else {
      await setUploadProgress(upload.id, 'Generating coaching feedback...')
      const claudeResult = await callClaude(nodeConfig, scoreResult, metricResults, errorResults, upload, context)
      feedback = claudeResult.feedback
      logData.claude_api = claudeResult.log
      llmDiagnostics = claudeResult.diagnostics
      logInfo('claude_feedback_received', {
        uploadId,
        feedbackLength: feedback.length,
      })
    }

    // STEP 12: Write results
    await ensureNotCancelled(upload.id)
    await setUploadProgress(upload.id, 'Writing analysis results...')
    const diagnostics = await buildRunDiagnostics({
      rtmlibResult,
      detFrequency,
      trackedKeypoints: trackedPersonFrames.keypoints,
      trackedScores: trackedPersonFrames.scores,
      phaseWindows: (logData.rtmlib?.phase_windows ?? []).map((w) => ({ phase: w.phase, start: w.start, end: w.end })),
      resolvedCalibration,
      calibrationAudit,
      metricResults,
      errorResults,
      errorDetectionLog: logData.error_detection ?? [],
      scoreResult,
      llm: llmDiagnostics,
    })
    await writeResults(upload, nodeConfig, scoreResult, metricResults, errorResults, feedback, logData, cloudRunMetadata, calibrationAudit, diagnostics)
    logInfo('results_written', {
      uploadId,
      aggregateScore: scoreResult.aggregate_score,
      detectedErrors: errorResults.detected.length,
    })

    // STEP 13: Update status to complete
    await updateUploadStatus(upload.id, 'complete', undefined, 'Analysis complete')
    logInfo('pipeline_completed', { uploadId, status: 'complete' })

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (error) {
    const err = error as Error

    if ((err as PipelineCancellationError).code === 'UPLOAD_CANCELLED') {
      logInfo('pipeline_cancelled', { uploadId, status: 'cancelled' })
      return new Response(JSON.stringify({ success: true, cancelled: true, uploadId }), { status: 200 })
    }

    console.error('Pipeline error:', {
      uploadId,
      message: err.message,
      stack: err.stack,
    })

    if (uploadId) {
      try {
        await updateUploadStatus(uploadId, 'failed', err.message, 'Analysis failed.')
      } catch (updateErr) {
        console.error('Failed to mark upload as failed:', {
          uploadId,
          updateError: (updateErr as Error).message,
        })
      }
    }

    return new Response(
      JSON.stringify({ error: err.message, uploadId }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})


async function fetchNodeConfig(nodeId: string) {
  const { data, error } = await supabase
    .from('athlete_lab_nodes')
    .select(`
      id, name, position, status, node_version,
      clip_duration_min, clip_duration_max,
      det_frequency_solo, det_frequency_defender, det_frequency_multiple,
      segmentation_method,
      llm_prompt_template, llm_system_instructions,
      llm_max_words,
      scoring_rules, score_bands, scoring_renormalize_on_skip,
      confidence_handling, min_metrics_threshold,
      camera_guidelines,
      key_metrics,
      phase_breakdown,
      reference_calibrations,
      reference_fallback_behavior,
      common_errors,
      form_checkpoints
    `)
    .eq('id', nodeId)
    .eq('status', 'live')
    .single()

  if (error || !data) throw new Error(`Node not found or not live: ${nodeId}`)
  return data
}


async function runPreflight(upload: any, nodeConfig: any) {
  const duration = upload.end_seconds - upload.start_seconds
  const checks = [
    {
      name: 'Clip duration',
      expected: `${nodeConfig.clip_duration_min}-${nodeConfig.clip_duration_max}s`,
      actual: `${duration}s`,
      result: duration < nodeConfig.clip_duration_min || duration > nodeConfig.clip_duration_max ? 'FAIL' as const : 'PASS' as const,
    },
    {
      name: 'Launch clip cap',
      expected: `<= ${MAX_CLIP_WINDOW_SECONDS}s (3-second clips are currently supported; longer clips coming soon)`,
      actual: `${duration}s`,
      result: duration > MAX_CLIP_WINDOW_SECONDS ? 'FAIL' as const : 'PASS' as const,
    },
    {
      name: 'Node status',
      expected: 'live',
      actual: nodeConfig.status || 'unknown',
      result: nodeConfig.status === 'live' ? 'PASS' as const : 'FAIL' as const,
    },
  ]

  const failedCheck = checks.find((check) => check.result === 'FAIL')
  if (failedCheck) {
    return { passed: false, reason: `${failedCheck.name}: ${failedCheck.actual}`, checks }
  }

  return { passed: true, checks }
  // Note: Resolution and frame occupancy checks happen after Cloud Run
  // returns the video metadata. Frame size check requires actual frame analysis.
}

function formatNumber(value: unknown, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : 'N/A'
}

function summarizeValue(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 120)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return `${value.length} items`
  if (value && typeof value === 'object') return JSON.stringify(value).slice(0, 120)
  return 'N/A'
}

function parsePhaseBreakdown(phases: any[]): Array<{ id: string; name: string }> {
  if (!Array.isArray(phases)) return []
  return phases.map((phase, index) => ({
    id: typeof phase?.id === 'string' ? phase.id : `phase-${index + 1}`,
    name: typeof phase?.name === 'string' ? phase.name : `Phase ${index + 1}`,
  }))
}

function buildPhaseWindowLog(
  phaseWindows: Record<string, { start: number; end: number }>,
  phaseBreakdown: any[],
  totalFrames: number,
) {
  const phases = parsePhaseBreakdown(phaseBreakdown)
  return phases.map((phase) => {
    const window = phaseWindows[phase.id] || { start: 0, end: 0 }
    const frameCount = Math.max(0, window.end - window.start + 1)
    return {
      phase: phase.name,
      start: window.start,
      end: window.end,
      frame_count: frameCount,
      percent: totalFrames > 0 ? Math.round((frameCount / totalFrames) * 100) : 0,
    }
  })
}

function summarizeKeypointConfidence(scores: VideoScores) {
  const totals = new Map<number, { total: number; min: number; minFrame: number; framesBelow: number; count: number }>()

  for (let frameIndex = 0; frameIndex < scores.length; frameIndex += 1) {
    const personScores = scores[frameIndex]?.[0]
    if (!Array.isArray(personScores)) continue

    personScores.forEach((score, index) => {
      if (!Number.isFinite(score)) return
      const current = totals.get(index) ?? { total: 0, min: 1, minFrame: frameIndex, framesBelow: 0, count: 0 }
      current.total += score
      current.count += 1
      if (score < current.min) {
        current.min = score
        current.minFrame = frameIndex
      }
      if (score < 0.7) current.framesBelow += 1
      totals.set(index, current)
    })
  }

  // Emit all observed indices (MediaPipe-33). Previously truncated to 17
  // (COCO-17 era), which hid confidence stats for indices 19-28 used by
  // active metrics (Plant Leg Extension: 23,25,27; Hip Stability: 23,24).
  // MediaPipe landmark name lookup deferred to Phase 1c.
  return Array.from(totals.entries())
    .map(([index, summary]) => {
      const mean = summary.count > 0 ? summary.total / summary.count : 0
      const percentBelow = summary.count > 0 ? (summary.framesBelow / summary.count) * 100 : 0
      return {
        index,
        name: `Keypoint ${index}`,
        mean_confidence: Number(mean.toFixed(3)),
        min_confidence: Number(summary.min.toFixed(3)),
        min_frame: summary.minFrame,
        frames_below: summary.framesBelow,
        total_frames: summary.count,
        percent_below: Number(percentBelow.toFixed(1)),
        status: percentBelow <= 10 ? 'RELIABLE' as const : percentBelow <= 30 ? 'MARGINAL' as const : 'UNRELIABLE' as const,
      }
    })
}

function buildMetricLogEntries(metricResults: any[], phaseWindows: Record<string, { start: number; end: number }>, phaseBreakdown: any[]) {
  const phaseNameMap = new Map(parsePhaseBreakdown(phaseBreakdown).map((phase) => [phase.id, phase.name]))

  return metricResults.map((metric) => {
    const phaseId = metric?.keypoint_mapping?.phase_id || metric?.phase_id || 'unknown'
    const window = phaseWindows[phaseId]
    const detail = metric?.detail && typeof metric.detail === 'object' ? metric.detail as JsonRecord : {}
    const value = typeof metric?.value === 'number' && Number.isFinite(metric.value) ? metric.value : null
    const deviation = typeof metric?.deviation === 'number' && Number.isFinite(metric.deviation) ? metric.deviation : null
    const score = typeof metric?.score === 'number' && Number.isFinite(metric.score) ? metric.score : 0

    return {
      name: typeof metric?.name === 'string' ? metric.name : 'Metric',
      weight: typeof metric?.weight === 'number' && Number.isFinite(metric.weight) ? metric.weight : 0,
      phase: phaseNameMap.get(phaseId) ?? phaseId,
      frames_evaluated: window ? Math.max(0, window.end - window.start + 1) : 0,
      frame_range: window ? `${window.start}-${window.end}` : 'N/A',
      keypoints: Array.isArray(metric?.keypoint_mapping?.keypoint_indices)
        ? metric.keypoint_mapping.keypoint_indices.join(', ')
        : '',
      calculation_type: typeof metric?.keypoint_mapping?.calculation_type === 'string'
        ? metric.keypoint_mapping.calculation_type
        : 'unknown',
      temporal_window: typeof metric?.keypoint_mapping?.temporal_window === 'number' && metric.keypoint_mapping.temporal_window > 0
        ? metric.keypoint_mapping.temporal_window
        : DEFAULT_TEMPORAL_WINDOW[metric?.keypoint_mapping?.calculation_type as string] ?? 0,
      extracted_values: value !== null ? formatNumber(value) : summarizeValue(detail),
      calculated_result: value !== null ? formatNumber(value) : metric?.reason || 'N/A',
      unit: typeof metric?.unit === 'string' ? metric.unit : '',
      elite_target: metric?.elite_target != null ? String(metric.elite_target) : '',
      deviation: deviation !== null ? formatNumber(deviation) : 'N/A',
      raw_score: score,
      weighted_contribution: formatNumber(score * (typeof metric?.weight === 'number' ? metric.weight : 0) / 100),
      status: metric?.status === 'scored' ? 'SCORED' as const : metric?.status === 'flagged' ? 'FLAGGED' as const : 'SKIPPED' as const,
      skip_reason: typeof metric?.reason === 'string' ? metric.reason : undefined,
    }
  })
}

function buildErrorDetectionLog(_errors: any[], _metricResults: any[], errorResults: { evaluations: ReturnType<typeof evaluateErrorRules> }) {
  return errorResults.evaluations.map((e) => ({
    name: e.name,
    auto_detectable: e.auto_detectable,
    condition: e.condition,
    metric_value: e.metric_value === null ? 'N/A' : formatNumber(e.metric_value, 2),
    evaluation_expression: e.condition || 'Manual review',
    triggered: e.triggered,
    reason: e.reason,
  }))
}


function clampDetFrequency(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.round(value))
}

function normalizePeopleInVideo(peopleInVideo: unknown): 'solo' | 'with_defender' | 'multiple' {
  if (typeof peopleInVideo === 'string') {
    const normalized = peopleInVideo.trim().toLowerCase()
    if (normalized === 'with_defender') return 'with_defender'
    if (normalized === 'multiple') return 'multiple'
    if (normalized === 'solo' || normalized === 'unknown' || normalized.length === 0) return 'solo'
  }

  if (typeof peopleInVideo === 'number' && Number.isFinite(peopleInVideo)) {
    if (peopleInVideo <= 1) return 'solo'
    if (peopleInVideo === 2) return 'with_defender'
    if (peopleInVideo > 2) return 'multiple'
  }

  return 'solo'
}

function getScenarioDetFrequency(nodeConfig: any, scenario: 'solo' | 'with_defender' | 'multiple'): number {
  // Phase 1c.2 Slice B1: resolver collapsed. Per-scenario columns are now
  // authoritative (pre-step UPDATE persisted resolved values into them). The
  // root `det_frequency` fallback is no longer consulted at runtime; the column
  // is preserved in the DB until Slice E for backup symmetry only. The nested
  // `detection_frequency` shape is retained as a defensive fallback for any
  // legacy node config that pre-dates the per-scenario columns.
  const nested = typeof nodeConfig?.detection_frequency === 'object' && nodeConfig?.detection_frequency !== null
    ? nodeConfig.detection_frequency
    : null

  switch (scenario) {
    case 'with_defender':
      return clampDetFrequency(
        nodeConfig?.det_frequency_defender ?? nested?.with_defender,
        1,
      )
    case 'multiple':
      return clampDetFrequency(
        nodeConfig?.det_frequency_multiple ?? nested?.multiple,
        1,
      )
    case 'solo':
    default:
      return clampDetFrequency(
        nodeConfig?.det_frequency_solo ?? nested?.solo,
        2,
      )
  }
}

function resolveBreakPhaseDetFrequency(phaseBreakdown: unknown): number | null {
  if (!Array.isArray(phaseBreakdown)) return null

  const breakPhase = phaseBreakdown.find((phase) => {
    if (!phase || typeof phase !== 'object') return false
    const rawName = (phase as JsonRecord).name
    const name = typeof rawName === 'string' ? rawName.trim().toLowerCase() : ''
    return name === 'break'
  }) as JsonRecord | undefined

  if (!breakPhase) return null

  const overrideValue = clampDetFrequency(
    breakPhase.det_frequency ?? breakPhase.detection_frequency,
    Number.NaN,
  )

  return Number.isFinite(overrideValue) ? overrideValue : null
}

function resolveDetectionFrequency(nodeConfig: any, context: JsonRecord): {
  scenario: 'solo' | 'with_defender' | 'multiple'
  baseValue: number
  breakOverrideValue: number | null
  breakOverrideApplied: boolean
  value: number
} {
  const scenario = normalizePeopleInVideo(context.people_in_video)
  const baseValue = getScenarioDetFrequency(nodeConfig, scenario)
  const breakOverrideValue = resolveBreakPhaseDetFrequency(nodeConfig?.phase_breakdown)
  const value = breakOverrideValue !== null ? Math.min(baseValue, breakOverrideValue) : baseValue

  return {
    scenario,
    baseValue,
    breakOverrideValue,
    breakOverrideApplied: breakOverrideValue !== null && value !== baseValue,
    value,
  }
}

function selectCalibration(nodeConfig: any, cameraAngle: string) {
  const calibrations = nodeConfig.reference_calibrations || []
  const match = calibrations.find(
    (c: any) => c.camera_angle?.toLowerCase() === cameraAngle?.toLowerCase()
  )
  return match || calibrations[0] || null
}

function getAthleteHeightMeasurement(context: JsonRecord): AthleteHeightMeasurement | undefined {
  const athleteHeight = context.athlete_height
  if (!athleteHeight || typeof athleteHeight !== 'object') return undefined

  const heightRecord = athleteHeight as JsonRecord
  const value = heightRecord.value
  const unit = heightRecord.unit

  if (typeof value !== 'number' || !Number.isFinite(value) || (unit !== 'inches' && unit !== 'cm')) {
    return undefined
  }

  return { value, unit }
}

function isolateTrackedPersonFrames(
  keypoints: VideoKeypoints,
  scores: VideoScores,
  personIndex: number,
): { keypoints: VideoKeypoints; scores: VideoScores } {
  return {
    keypoints: keypoints.map((frame) => {
      const person = frame?.[personIndex]
      return person ? [person] : []
    }),
    scores: scores.map((frame) => {
      const person = frame?.[personIndex]
      return person ? [person] : []
    }),
  }
}

function getPixelsPerYardValue(calibration: CalibrationLike | CloudRunCalibrationInput | null): number | null {
  const camelValue = calibration?.pixelsPerYard
  if (typeof camelValue === 'number' && Number.isFinite(camelValue) && camelValue > 0) return camelValue

  const snakeValue = calibration?.pixels_per_yard
  if (typeof snakeValue === 'number' && Number.isFinite(snakeValue) && snakeValue > 0) return snakeValue

  return null
}

function getCalibrationConfidenceLabel(calibration: CloudRunCalibrationInput): string | null {
  const camelValue = calibration.calibrationConfidence
  if (typeof camelValue === 'string' && camelValue.length > 0) return camelValue

  const snakeValue = calibration.calibration_confidence
  if (typeof snakeValue === 'string' && snakeValue.length > 0) return snakeValue

  return null
}

function getCalibrationSourceLabel(calibration: CloudRunCalibrationInput): string | null {
  const camelValue = calibration.calibrationSource
  if (typeof camelValue === 'string' && camelValue.trim().length > 0) return camelValue.trim().toLowerCase()

  const snakeValue = calibration.calibration_source
  if (typeof snakeValue === 'string' && snakeValue.trim().length > 0) return snakeValue.trim().toLowerCase()

  return null
}

function getCalibrationDetailsRecord(calibration: CloudRunCalibrationInput): JsonRecord {
  const camelValue = calibration.calibrationDetails
  if (camelValue && typeof camelValue === 'object' && !Array.isArray(camelValue)) {
    return camelValue as JsonRecord
  }

  const snakeValue = calibration.calibration_details
  if (snakeValue && typeof snakeValue === 'object' && !Array.isArray(snakeValue)) {
    return snakeValue as JsonRecord
  }

  return {}
}

function getCalibrationFlagLabel(calibration: CloudRunCalibrationInput): string | null {
  const camelValue = calibration.calibrationFlag
  if (typeof camelValue === 'string' && camelValue.trim().length > 0) return camelValue.trim().toLowerCase()

  const snakeValue = calibration.calibration_flag
  if (typeof snakeValue === 'string' && snakeValue.trim().length > 0) return snakeValue.trim().toLowerCase()

  return null
}

function getGoodLinePairsValue(calibration: CloudRunCalibrationInput): number | null {
  const camelValue = calibration.goodLinePairs
  if (typeof camelValue === 'number' && Number.isFinite(camelValue) && camelValue >= 0) return camelValue

  const snakeValue = calibration.good_line_pairs
  if (typeof snakeValue === 'number' && Number.isFinite(snakeValue) && snakeValue >= 0) return snakeValue

  return null
}

function getCalibrationRejectionReason(calibration: CloudRunCalibrationInput): string | null {
  const camelValue = calibration.rejectionReason
  if (typeof camelValue === 'string' && camelValue.trim().length > 0) return camelValue.trim()

  const snakeValue = calibration.rejection_reason
  if (typeof snakeValue === 'string' && snakeValue.trim().length > 0) return snakeValue.trim()

  return null
}

function isDynamicCalibrationTrusted(calibration: CloudRunCalibrationInput): {
  accepted: boolean
  reason: string
  sourceLabel: string | null
  confidenceLabel: string | null
  goodLinePairs: number | null
  pixelsPerYard: number | null
  calibrationFlag: string | null
  details: JsonRecord
  rejectionReason: string | null
} {
  const pixelsPerYard = getPixelsPerYardValue(calibration)
  const confidenceLabel = getCalibrationConfidenceLabel(calibration)
  const sourceLabel = getCalibrationSourceLabel(calibration)
  const details = getCalibrationDetailsRecord(calibration)
  const calibrationFlag = getCalibrationFlagLabel(calibration)
  const goodLinePairs = getGoodLinePairsValue(calibration)
  const rejectionReason = getCalibrationRejectionReason(calibration)
  const trustedBySource = sourceLabel === 'dynamic'
  const trustedByConfidence = confidenceLabel === 'dynamic' || confidenceLabel === 'trusted'
  const withinExpectedRange = pixelsPerYard !== null && pixelsPerYard >= 40 && pixelsPerYard <= 120
  const linePairThresholdMet = goodLinePairs === null || goodLinePairs >= 8
  const explicitlyUnreliable = calibrationFlag === 'unreliable'

  if (pixelsPerYard === null) {
    return {
      accepted: false,
      reason: rejectionReason || 'dynamic_pixels_per_yard_unavailable',
      sourceLabel,
      confidenceLabel,
      goodLinePairs,
      pixelsPerYard,
      calibrationFlag,
      details,
      rejectionReason,
    }
  }

  if (!withinExpectedRange) {
    return {
      accepted: false,
      reason: rejectionReason || 'dynamic_pixels_per_yard_out_of_range',
      sourceLabel,
      confidenceLabel,
      goodLinePairs,
      pixelsPerYard,
      calibrationFlag,
      details,
      rejectionReason,
    }
  }

  if (!linePairThresholdMet) {
    return {
      accepted: false,
      reason: rejectionReason || 'dynamic_line_pair_count_below_threshold',
      sourceLabel,
      confidenceLabel,
      goodLinePairs,
      pixelsPerYard,
      calibrationFlag,
      details,
      rejectionReason,
    }
  }

  if (explicitlyUnreliable) {
    return {
      accepted: false,
      reason: rejectionReason || 'dynamic_marked_unreliable',
      sourceLabel,
      confidenceLabel,
      goodLinePairs,
      pixelsPerYard,
      calibrationFlag,
      details,
      rejectionReason,
    }
  }

  if (!trustedBySource && !trustedByConfidence) {
    return {
      accepted: false,
      reason: rejectionReason || `dynamic_confidence_${confidenceLabel || 'missing'}`,
      sourceLabel,
      confidenceLabel,
      goodLinePairs,
      pixelsPerYard,
      calibrationFlag,
      details,
      rejectionReason,
    }
  }

  return {
    accepted: true,
    reason: 'cloud_run_dynamic_calibration',
    sourceLabel,
    confidenceLabel,
    goodLinePairs,
    pixelsPerYard,
    calibrationFlag,
    details,
    rejectionReason,
  }
}

function logCalibrationSource(calibration: ResolvedCalibration) {
  const details = calibration.details
  const pixelsPerYard = calibration.pixelsPerYard
  const goodLinePairs = typeof details.goodLinePairs === 'number' && Number.isFinite(details.goodLinePairs)
    ? details.goodLinePairs
    : typeof details.good_line_pairs === 'number' && Number.isFinite(details.good_line_pairs)
      ? details.good_line_pairs
      : null

  let message = 'Calibration source: none (raw pixels)'

  if (calibration.source === 'dynamic') {
    message = `Calibration source: dynamic (${goodLinePairs ?? 'unknown'} line pairs, ${pixelsPerYard !== null ? pixelsPerYard.toFixed(1) : 'n/a'} px/yard)`
  } else if (calibration.source === 'height_based') {
    message = `Calibration source: height-based ${calibration.perFrame ? 'per-frame' : 'single'} (${pixelsPerYard !== null ? pixelsPerYard.toFixed(1) : 'n/a'} px/yard median)`
  } else if (calibration.source === 'body_based') {
    message = 'Calibration source: body-based (using athlete height)'
  } else if (calibration.source === 'static') {
    message = `Calibration source: static (${pixelsPerYard !== null ? pixelsPerYard.toFixed(1) : 'n/a'} px/yard from node config)`
  }

  logInfo('calibration_source_selected', {
    source: calibration.source,
    pixelsPerYard,
    confidence: calibration.confidence,
    message,
    details,
  })
}

function getCalibrationMetricDetail(calibration: ResolvedCalibration): JsonRecord {
  return {
    calibrationSource: calibration.source,
    calibrationConfidence: calibration.confidence,
    pixelsPerYard: calibration.pixelsPerYard,
    calibrationFlag: calibration.details.calibrationFlag ?? calibration.details.calibration_flag ?? null,
    calibrationDetails: calibration.details,
  }
}

function resolveCalibration(
  cloudRunCalibration: CloudRunCalibrationInput,
  keypoints: VideoKeypoints,
  scores: VideoScores,
  athleteHeight: AthleteHeightMeasurement | undefined,
  nodeConfig: any,
  cameraAngle: string,
  resolutionHeight: number | null = null,
): CalibrationResolutionOutcome {
  const dynamicAssessment = isDynamicCalibrationTrusted(cloudRunCalibration)

  logInfo('dynamic_calibration_assessed', {
    source: dynamicAssessment.sourceLabel,
    confidence: dynamicAssessment.confidenceLabel,
    pixelsPerYard: dynamicAssessment.pixelsPerYard,
    goodLinePairs: dynamicAssessment.goodLinePairs,
    accepted: dynamicAssessment.accepted,
    reason: dynamicAssessment.reason,
    rejectionReason: dynamicAssessment.rejectionReason,
    message: dynamicAssessment.goodLinePairs !== null && dynamicAssessment.pixelsPerYard !== null
      ? `Dynamic calibration: found ${dynamicAssessment.goodLinePairs} line pairs, calculated ${dynamicAssessment.pixelsPerYard.toFixed(2)} px/yard`
      : 'Dynamic calibration diagnostics incomplete',
    details: dynamicAssessment.details,
  })

  const dynamicFailureReason = dynamicAssessment.accepted ? null : dynamicAssessment.reason

  // Slice C.5 — UNCONDITIONAL computation of both calibration candidates.
  // Selection priority below is unchanged (dynamic → body_based → static → none);
  // this block only adds shadow observation so calibration_audit always carries
  // both ppy values for cross-clip ground-truth comparison.
  const bodyBasedCalibration = athleteHeight
    ? calculateBodyBasedCalibration(keypoints, scores, athleteHeight)
    : null
  const staticCalibration = selectCalibration(nodeConfig, cameraAngle)
  const staticPixelsPerYard = getPixelsPerYardValue(staticCalibration)

  const heightYards = athleteHeight ? convertHeightToYards(athleteHeight) : null
  const heightCalibration: HeightCalibration | null = heightYards
    ? computeHeightCalibration(keypoints.map((f) => f?.[0]), scores.map((f) => f?.[0]), heightYards)
    : null
  const heightPerFrameOk = Boolean(heightCalibration?.perFrame.accepted && heightCalibration.perFrame.series)
  const heightSingleOk = Boolean(heightCalibration?.single.accepted && heightCalibration.single.ppy)

  const bodyBasedAcceptable = bodyBasedCalibration !== null
    && bodyBasedCalibration.pixelsPerYard !== null
    && bodyBasedCalibration.confidence >= 0.3

  // Selection priority (unchanged behavior).
  let resolved: ResolvedCalibration
  let selectedSource: CalibrationAudit['selected_source']

  if (dynamicAssessment.accepted && dynamicAssessment.pixelsPerYard !== null) {
    selectedSource = 'dynamic'
    resolved = {
      pixelsPerYard: dynamicAssessment.pixelsPerYard,
      source: 'dynamic',
      confidence: dynamicAssessment.goodLinePairs !== null
        ? clamp(dynamicAssessment.goodLinePairs / 12, 0.65, 1)
        : 1,
      reason: dynamicAssessment.reason,
      details: {
        pixelsPerYard: dynamicAssessment.pixelsPerYard,
        calibrationConfidence: dynamicAssessment.confidenceLabel,
        calibrationSource: dynamicAssessment.sourceLabel,
        calibrationFlag: dynamicAssessment.calibrationFlag,
        goodLinePairs: dynamicAssessment.goodLinePairs,
        rejectionReason: dynamicAssessment.rejectionReason,
        ...dynamicAssessment.details,
      },
    }
  } else if (heightCalibration && (heightPerFrameOk || heightSingleOk)) {
    selectedSource = 'height_based'
    const series = heightPerFrameOk ? heightCalibration.perFrame.series : null
    const ppy = series
      ? windowScale(series, 0, series.length - 1)
      : heightCalibration.single.ppy
    resolved = {
      pixelsPerYard: ppy,
      perFrame: series,
      source: 'height_based',
      confidence: series ? 0.85 : 0.7,
      reason: series ? 'height_based_per_frame_accepted' : 'height_based_single_accepted',
      details: {
        method: series ? 'per_frame_height' : 'single_height_p80_upright',
        pixelsPerYard: ppy,
        dynamicFailureReason,
        perFrame: { ...heightCalibration.perFrame, series: undefined },
        single: heightCalibration.single,
      },
    }
  } else if (athleteHeight && bodyBasedAcceptable && bodyBasedCalibration) {
    logInfo('calibration_source_fallback', {
      from: 'dynamic',
      to: 'body_based',
      reason: dynamicFailureReason,
    })
    selectedSource = 'body_based'
    resolved = {
      pixelsPerYard: bodyBasedCalibration.pixelsPerYard,
      source: 'body_based',
      confidence: bodyBasedCalibration.confidence,
      reason: 'body_based_calibration_accepted',
      details: {
        method: bodyBasedCalibration.method,
        pixelsPerYard: bodyBasedCalibration.pixelsPerYard,
        dynamicFailureReason,
        ...bodyBasedCalibration.details,
      },
    }
  } else if (staticPixelsPerYard !== null) {
    if (athleteHeight && bodyBasedCalibration) {
      logInfo('calibration_source_fallback', {
        from: 'body_based',
        to: 'static',
        reason: bodyBasedCalibration.pixelsPerYard === null
          ? 'body_based_confidence_below_threshold'
          : 'body_based_calibration_unusable',
      })
    } else {
      logInfo('calibration_source_fallback', {
        from: 'dynamic',
        to: 'static',
        reason: `${dynamicFailureReason}_and_no_athlete_height`,
      })
    }
    selectedSource = 'static'
    resolved = {
      pixelsPerYard: staticPixelsPerYard,
      source: 'static',
      confidence: 0.45,
      reason: 'node_reference_calibration',
      details: {
        cameraAngle,
        pixelsPerYard: staticPixelsPerYard,
        dynamicFailureReason,
        matchedCalibration: staticCalibration ?? {},
        resolutionHeight,
        assumedResolutionHeight: STATIC_ASSUMED_HEIGHT_PX,
      },
    }
  } else {
    logInfo('calibration_source_fallback', {
      from: athleteHeight ? 'static' : 'dynamic',
      to: 'none',
      reason: 'no_valid_static_calibration',
    })
    selectedSource = 'none'
    resolved = {
      pixelsPerYard: null,
      source: 'none',
      confidence: 0,
      reason: 'no_calibration_available',
      details: {
        dynamicFailureReason,
        athleteHeightProvided: Boolean(athleteHeight),
        staticCalibrationFound: Boolean(staticCalibration),
        calibrationFlag: 'unreliable',
        cameraAngle,
      },
    }
  }

  logInfo('calibration_resolved', resolved)
  logCalibrationSource(resolved)

  // Build calibration_audit. Key order is explicit to keep result_data
  // bit-stable across runs (Section A/B determinism guarantee).
  let bodyBasedStatus: BodyBasedAuditStatus
  if (!athleteHeight) {
    bodyBasedStatus = 'not_attempted_no_athlete_height'
  } else if (selectedSource === 'body_based') {
    bodyBasedStatus = 'used'
  } else if (bodyBasedCalibration && bodyBasedCalibration.pixelsPerYard === null) {
    bodyBasedStatus = 'unusable_no_value'
  } else if (bodyBasedCalibration && !bodyBasedAcceptable) {
    bodyBasedStatus = 'unusable_low_confidence'
  } else {
    // Computed acceptable, but a higher-priority path won (dynamic).
    bodyBasedStatus = 'computed_but_not_selected'
  }

  let staticStatus: StaticAuditStatus
  if (staticPixelsPerYard === null) {
    staticStatus = 'unusable_no_value'
  } else if (selectedSource === 'static') {
    staticStatus = 'used'
  } else {
    staticStatus = 'computed_but_not_selected'
  }

  const serviceSource = getCalibrationSourceLabel(cloudRunCalibration)
  const candidates: JsonRecord[] = [
    {
      source: 'dynamic',
      ppy: serviceSource === 'dynamic' ? dynamicAssessment.pixelsPerYard : null,
      status: dynamicAssessment.accepted ? 'used' : 'rejected',
      reason: dynamicAssessment.accepted ? dynamicAssessment.reason : (serviceSource === 'dynamic' ? dynamicAssessment.reason : 'no_line_detection_in_service'),
    },
    {
      source: 'service_body_width',
      ppy: serviceSource === 'dynamic' ? null : dynamicAssessment.pixelsPerYard,
      status: 'reference_only',
      reason: 'service width estimate (fixed 0.45 yd shoulders / 0.32 yd hips); not used for selection',
      details: dynamicAssessment.details,
    },
    {
      source: 'height_based',
      ppy: heightCalibration
        ? (heightPerFrameOk ? windowScale(heightCalibration.perFrame.series as number[], 0, (heightCalibration.perFrame.series as number[]).length - 1) : heightCalibration.single.ppy)
        : null,
      status: selectedSource === 'height_based' ? 'used' : heightCalibration ? ((heightPerFrameOk || heightSingleOk) ? 'computed_but_not_selected' : 'rejected') : 'not_attempted_no_athlete_height',
      mode: heightPerFrameOk ? 'per_frame' : heightSingleOk ? 'single' : null,
      per_frame: heightCalibration ? { ...heightCalibration.perFrame, series: undefined } : null,
      raw_series: heightCalibration?.rawSeries ?? null,
      outlier_frames: heightCalibration?.outlierFrames ?? [],
      single: heightCalibration?.single ?? null,
    },
    {
      source: 'body_width',
      ppy: bodyBasedCalibration?.pixelsPerYard ?? null,
      status: selectedSource === 'body_based' ? 'used' : bodyBasedAcceptable ? 'computed_but_not_selected' : 'rejected',
      confidence: bodyBasedCalibration?.confidence ?? null,
      details: bodyBasedCalibration?.details ?? null,
    },
    {
      source: 'static',
      ppy: staticPixelsPerYard,
      status: selectedSource === 'static' ? 'used' : staticPixelsPerYard === null ? 'unusable_no_value' : 'computed_but_not_selected',
      camera_angle: cameraAngle,
      resolution_assumed: `${STATIC_ASSUMED_HEIGHT_PX}p`,
      clip_resolution_height: resolutionHeight,
    },
  ]
  const rejectedReasons: Record<string, string> = {}
  if (!dynamicAssessment.accepted) rejectedReasons.dynamic = String(candidates[0].reason)
  if (heightCalibration && !heightPerFrameOk) rejectedReasons.height_based_per_frame = heightCalibration.perFrame.reason
  if (heightCalibration && !heightSingleOk) rejectedReasons.height_based_single = heightCalibration.single.reason
  if (!athleteHeight) rejectedReasons.height_based = 'no_athlete_height'
  if (bodyBasedCalibration && !bodyBasedAcceptable) rejectedReasons.body_width = 'confidence_below_0.3_or_no_value'

  const flags: JsonRecord[] = []
  if (selectedSource === 'height_based' && heightPerFrameOk && heightCalibration?.depthMotionPresent) {
    flags.push({
      flag: 'depth_motion_present',
      change_pct: heightCalibration.perFrame.changePct,
      threshold: DEPTH_MOTION_THRESHOLD,
      note: 'Athlete moves toward or away from the camera; motion along that axis is not captured, so speed and distance along it may read low.',
    })
  }
  if (selectedSource === 'static' && resolutionHeight !== null && resolutionHeight !== STATIC_ASSUMED_HEIGHT_PX) {
    flags.push({
      flag: 'static_resolution_mismatch',
      clip_resolution_height: resolutionHeight,
      assumed_resolution_height: STATIC_ASSUMED_HEIGHT_PX,
      note: 'Static px/yd assumes 1080p; this clip differs, so distances and speeds are likely off.',
    })
  }

  const series = resolved.perFrame ?? null
  const audit: CalibrationAudit = {
    selected_source: selectedSource,
    selected_ppy: resolved.pixelsPerYard,
    selected_mode: selectedSource === 'height_based' ? (series ? 'per_frame' : 'single') : null,
    selection_rule: 'first acceptable in priority order: dynamic > height_based (per_frame, then single) > body_width > static',
    candidates,
    rejected_reasons: rejectedReasons,
    per_frame_scale: series
      ? { enabled: true, min: Math.min(...series), max: Math.max(...series), start: series[0], end: series[series.length - 1], smoothing: 'median5 + mean5, max step 3%', series }
      : null,
    flags,
    dynamic_status: dynamicAssessment.accepted ? 'used' : 'failed',
    dynamic_failure_reason: dynamicFailureReason,
    body_based_status: bodyBasedStatus,
    body_based_ppy: bodyBasedCalibration?.pixelsPerYard ?? null,
    body_based_confidence: bodyBasedCalibration?.confidence ?? null,
    static_status: staticStatus,
    static_ppy: staticPixelsPerYard,
    camera_angle: cameraAngle,
    athlete_height_provided: Boolean(athleteHeight),
    node_id: typeof nodeConfig?.id === 'string' ? nodeConfig.id : '',
    node_version: typeof nodeConfig?.node_version === 'number' ? nodeConfig.node_version : 0,
  }

  logInfo('calibration_audit', audit)

  return { resolved, audit }
}

async function lookupClipResolutionHeight(context: any): Promise<number | null> {
  const direct = parseResolutionHeight(context?.resolution ?? context?.video_resolution)
  if (direct !== null) return direct
  const clipId = typeof context?.calibration_clip_id === 'string' ? context.calibration_clip_id : null
  if (!clipId) return null
  const { data } = await supabase.from('calibration_clips').select('resolution').eq('id', clipId).maybeSingle()
  return parseResolutionHeight(data?.resolution)
}

function convertHeightToYards(height: AthleteHeightMeasurement): number | null {
  if (!Number.isFinite(height.value) || height.value <= 0) return null
  return height.unit === 'cm' ? height.value / 91.44 : height.value / 36
}

function isValidPoint(point: Point | undefined): point is Point {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
}

function distanceBetweenPoints(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function calculateBodyBasedCalibration(
  keypoints: VideoKeypoints,
  scores: VideoScores,
  athleteHeight: AthleteHeightMeasurement,
): BodyBasedCalibrationResult {
  const heightYards = convertHeightToYards(athleteHeight)
  const expectedHipWidthYards = heightYards ? heightYards * 0.191 : 0
  const expectedShoulderWidthYards = heightYards ? heightYards * 0.259 : 0

  if (!heightYards || expectedHipWidthYards <= 0 || expectedShoulderWidthYards <= 0) {
    return {
      pixelsPerYard: null,
      confidence: 0,
      source: 'body_based',
      method: 'multi_frame_body_proportions_hips_shoulders',
      details: {
        hipWidthPixels: 0,
        shoulderWidthPixels: 0,
        framesUsed: 0,
        expectedHipWidthYards,
        expectedShoulderWidthYards,
      },
    }
  }

  const samples: BodyMeasurementSample[] = []

  for (let frameIndex = 0; frameIndex < keypoints.length; frameIndex += 5) {
    const frameKeypoints = keypoints[frameIndex]?.[0]
    const frameScores = scores[frameIndex]?.[0]

    if (!Array.isArray(frameKeypoints) || !Array.isArray(frameScores)) continue

    // MediaPipe Pose-33 indices: 11=L shoulder, 12=R shoulder, 23=L hip, 24=R hip.
    // Previously used COCO-17 indices [5,6,11,12], which on MediaPipe-33 data
    // map to ear/eye landmarks → produced impossible measurements (e.g. 186mph
    // release speed). Anthropometric ratios below (0.259 shoulder, 0.191 hip of
    // standing height) are landmark-agnostic and remain correct under this swap.
    const leftShoulder = frameKeypoints[11]
    const rightShoulder = frameKeypoints[12]
    const leftHip = frameKeypoints[23]
    const rightHip = frameKeypoints[24]

    const leftShoulderScore = frameScores[11]
    const rightShoulderScore = frameScores[12]
    const leftHipScore = frameScores[23]
    const rightHipScore = frameScores[24]

    const shoulderValid = isValidPoint(leftShoulder) && isValidPoint(rightShoulder)
      && Number.isFinite(leftShoulderScore) && Number.isFinite(rightShoulderScore)
    const hipValid = isValidPoint(leftHip) && isValidPoint(rightHip)
      && Number.isFinite(leftHipScore) && Number.isFinite(rightHipScore)

    if (!shoulderValid && !hipValid) continue

    const shoulderWidthPixels = shoulderValid
      ? distanceBetweenPoints(leftShoulder, rightShoulder)
      : null
    const hipWidthPixels = hipValid
      ? distanceBetweenPoints(leftHip, rightHip)
      : null

    const shoulderPixelsPerYard = shoulderWidthPixels !== null
      ? shoulderWidthPixels / expectedShoulderWidthYards
      : null
    const hipPixelsPerYard = hipWidthPixels !== null
      ? hipWidthPixels / expectedHipWidthYards
      : null

    const confidenceInputs: number[] = []
    if (shoulderValid) confidenceInputs.push(leftShoulderScore, rightShoulderScore)
    if (hipValid) confidenceInputs.push(leftHipScore, rightHipScore)

    samples.push({
      frameIndex,
      hipWidthPixels,
      shoulderWidthPixels,
      hipPixelsPerYard,
      shoulderPixelsPerYard,
      averageConfidence: average(confidenceInputs),
    })
  }

  const hipWidths = samples
    .map((sample) => sample.hipWidthPixels)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const shoulderWidths = samples
    .map((sample) => sample.shoulderWidthPixels)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const perFrameEstimates = samples.flatMap((sample) => {
    const estimates: number[] = []
    if (typeof sample.hipPixelsPerYard === 'number' && Number.isFinite(sample.hipPixelsPerYard)) {
      estimates.push(sample.hipPixelsPerYard)
    }
    if (typeof sample.shoulderPixelsPerYard === 'number' && Number.isFinite(sample.shoulderPixelsPerYard)) {
      estimates.push(sample.shoulderPixelsPerYard)
    }
    return estimates
  })

  const rawPixelsPerYard = perFrameEstimates.length > 0 ? average(perFrameEstimates) : null
  const averageKeypointConfidence = average(samples.map((sample) => sample.averageConfidence))
  const estimateStdDev = standardDeviation(perFrameEstimates)
  const estimateMean = rawPixelsPerYard ?? 0
  const relativeVariance = estimateMean > 0 ? estimateStdDev / estimateMean : 1

  let confidence = 1
  confidence -= clamp(1 - averageKeypointConfidence, 0, 1) * 0.5
  confidence -= clamp(relativeVariance, 0, 1) * 0.3

  if (rawPixelsPerYard === null) {
    confidence = 0
  } else if (rawPixelsPerYard < 40) {
    confidence -= clamp((40 - rawPixelsPerYard) / 40, 0, 1) * 0.2
  } else if (rawPixelsPerYard > 150) {
    confidence -= clamp((rawPixelsPerYard - 150) / 150, 0, 1) * 0.2
  }

  confidence = clamp(confidence, 0, 1)

  return {
    pixelsPerYard: confidence >= 0.3 ? rawPixelsPerYard : null,
    confidence,
    source: 'body_based',
    method: 'multi_frame_body_proportions_hips_shoulders',
    details: {
      hipWidthPixels: average(hipWidths),
      shoulderWidthPixels: average(shoulderWidths),
      framesUsed: samples.length,
      expectedHipWidthYards,
      expectedShoulderWidthYards,
    },
  }
}

function pixelsPerSecondToMph(pixelsPerSecond: number, pixelsPerYard: number | null): number | null {
  if (!pixelsPerYard || pixelsPerYard <= 0) return null
  return (pixelsPerSecond * 2.045) / pixelsPerYard
}


function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeWindowSize(value: unknown): number {
  const normalized = isFiniteNumber(value) ? Math.max(3, Math.round(value)) : 3
  return normalized % 2 === 0 ? normalized + 1 : normalized
}

function normalizeConfidenceThreshold(value: unknown): number {
  return isFiniteNumber(value) ? clamp(value, 0, 1) : 0.7
}

function extractMetricMapping(metric: unknown): Record<string, unknown> | null {
  if (!metric || typeof metric !== 'object') return null
  const mapping = (metric as Record<string, unknown>).keypoint_mapping
  return mapping && typeof mapping === 'object' ? mapping as Record<string, unknown> : null
}

function extractMetricKeypointIndices(metric: unknown): number[] {
  const mapping = extractMetricMapping(metric)
  if (!mapping) return []

  const indices = Array.isArray(mapping.keypoint_indices)
    ? mapping.keypoint_indices.filter((value): value is number => isFiniteNumber(value) && value >= 0)
    : []
  const singleIndex = isFiniteNumber(mapping.keypoint_index) && mapping.keypoint_index >= 0
    ? [mapping.keypoint_index]
    : []

  return Array.from(new Set([...indices, ...singleIndex].map((value) => Math.round(value))))
}

function buildTemporalSmoothingConfig(nodeConfig: unknown) {
  const metrics = Array.isArray((nodeConfig as Record<string, unknown> | null)?.key_metrics)
    ? ((nodeConfig as Record<string, unknown>).key_metrics as unknown[])
    : []

  const keypointSettings = new Map<number, { windowSize: number; confidenceThreshold: number }>()

  for (const metric of metrics) {
    const mapping = extractMetricMapping(metric)
    const keypointIndices = extractMetricKeypointIndices(metric)
    if (!mapping || keypointIndices.length === 0) continue

    const windowSize = normalizeWindowSize(mapping.temporal_window)
    const confidenceThreshold = normalizeConfidenceThreshold(mapping.confidence_threshold)

    for (const keypointIndex of keypointIndices) {
      const existing = keypointSettings.get(keypointIndex)
      keypointSettings.set(keypointIndex, {
        windowSize: existing ? Math.max(existing.windowSize, windowSize) : windowSize,
        confidenceThreshold: existing ? Math.max(existing.confidenceThreshold, confidenceThreshold) : confidenceThreshold,
      })
    }
  }

  const keypointIndices = Array.from(keypointSettings.keys()).sort((a, b) => a - b)
  const defaultWindowSize = keypointIndices.length > 0
    ? Math.max(...keypointIndices.map((index) => keypointSettings.get(index)?.windowSize ?? 3))
    : 3

  return { keypointIndices, keypointSettings, defaultWindowSize }
}

function interpolateLowConfidenceGap(series: Array<number | null>, reliableFrames: boolean[], maxGap = 5): Array<number | null> {
  const repaired = [...series]
  let frameIndex = 0

  while (frameIndex < repaired.length) {
    if (reliableFrames[frameIndex]) {
      frameIndex += 1
      continue
    }

    const gapStart = frameIndex
    while (frameIndex < repaired.length && !reliableFrames[frameIndex]) {
      frameIndex += 1
    }

    const gapEnd = frameIndex - 1
    const gapLength = gapEnd - gapStart + 1
    const leftIndex = gapStart - 1
    const rightIndex = frameIndex

    if (
      gapLength > maxGap ||
      leftIndex < 0 ||
      rightIndex >= repaired.length ||
      !reliableFrames[leftIndex] ||
      !reliableFrames[rightIndex] ||
      repaired[leftIndex] === null ||
      repaired[rightIndex] === null
    ) {
      continue
    }

    const leftValue = repaired[leftIndex] as number
    const rightValue = repaired[rightIndex] as number
    const span = rightIndex - leftIndex

    for (let offset = 1; offset < span; offset += 1) {
      const ratio = offset / span
      repaired[leftIndex + offset] = leftValue + (rightValue - leftValue) * ratio
    }
  }

  return repaired
}

function applyCenteredMovingAverage(series: Array<number | null>, windowSize: number): Array<number | null> {
  const halfWindow = Math.floor(windowSize / 2)

  return series.map((value, index) => {
    const windowValues: number[] = []
    for (let frameIndex = Math.max(0, index - halfWindow); frameIndex <= Math.min(series.length - 1, index + halfWindow); frameIndex += 1) {
      const frameValue = series[frameIndex]
      if (frameValue !== null) {
        windowValues.push(frameValue)
      }
    }

    if (windowValues.length < 2) {
      return value
    }

    return average(windowValues)
  })
}

function cloneVideoKeypoints(keypoints: VideoKeypoints): VideoKeypoints {
  return keypoints.map((frame) => frame.map((person) => person.map((point) => [point[0], point[1]] as Point)))
}

function applyTemporalSmoothing(keypoints: VideoKeypoints, scores: VideoScores, nodeConfig: unknown): VideoKeypoints {
  const { keypointIndices, keypointSettings, defaultWindowSize } = buildTemporalSmoothingConfig(nodeConfig)
  if (keypoints.length === 0 || keypointIndices.length === 0) {
    return keypoints
  }

  const smoothed = cloneVideoKeypoints(keypoints)
  const frameCount = keypoints.length
  const maxPersonCount = keypoints.reduce((maxCount, frame) => Math.max(maxCount, frame.length), 0)

  for (let personIndex = 0; personIndex < maxPersonCount; personIndex += 1) {
    for (const keypointIndex of keypointIndices) {
      const settings = keypointSettings.get(keypointIndex)
      if (!settings) continue

      const xSeries: Array<number | null> = Array.from({ length: frameCount }, () => null)
      const ySeries: Array<number | null> = Array.from({ length: frameCount }, () => null)
      const reliableFrames = Array.from({ length: frameCount }, () => false)

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const point = keypoints[frameIndex]?.[personIndex]?.[keypointIndex]
        const score = scores[frameIndex]?.[personIndex]?.[keypointIndex]
        if (!isValidPoint(point)) continue

        xSeries[frameIndex] = point[0]
        ySeries[frameIndex] = point[1]
        reliableFrames[frameIndex] = isFiniteNumber(score) && score >= settings.confidenceThreshold
      }

      const repairedX = interpolateLowConfidenceGap(xSeries, reliableFrames)
      const repairedY = interpolateLowConfidenceGap(ySeries, reliableFrames)
      const smoothedX = applyCenteredMovingAverage(repairedX, settings.windowSize)
      const smoothedY = applyCenteredMovingAverage(repairedY, settings.windowSize)

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const nextX = smoothedX[frameIndex]
        const nextY = smoothedY[frameIndex]
        if (nextX === null || nextY === null || !smoothed[frameIndex]?.[personIndex]?.[keypointIndex]) continue

        smoothed[frameIndex][personIndex][keypointIndex] = [nextX, nextY]
      }
    }
  }

  const keypointWindowMap = Object.fromEntries(
    keypointIndices.map((keypointIndex) => [String(keypointIndex), keypointSettings.get(keypointIndex)?.windowSize ?? 3])
  )
  logInfo('temporal_smoothing_applied', {
    message: `Applied temporal smoothing (window = ${defaultWindowSize} frames) for ${keypointIndices.length} keypoints`,
    windowSize: defaultWindowSize,
    keypointCount: keypointIndices.length,
    keypointWindows: keypointWindowMap,
  })

  return smoothed
}


function lockTargetPerson(
  keypoints: VideoKeypoints,
  peopleInVideo: string
): number {
  // Use first frame with most detections
  const firstFrame = keypoints[0] || []
  if (firstFrame.length <= 1) return 0

  // Select person with largest bounding box
  let maxArea = 0
  let targetIndex = 0

  for (let p = 0; p < firstFrame.length; p++) {
    const kps = firstFrame[p].filter(kp => kp[0] > 0 && kp[1] > 0)
    if (kps.length < 2) continue
    
    const xs = kps.map(kp => kp[0])
    const ys = kps.map(kp => kp[1])
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    
    if (area > maxArea) {
      maxArea = area
      targetIndex = p
    }
  }

  return targetIndex
}


function clampFrame(frame: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0
  return Math.max(0, Math.min(totalFrames - 1, frame))
}

function calculatePhaseWindows(totalFrames: number, phaseBreakdown: any[], frameBuffer: number) {
  const windows: Record<string, { start: number, end: number }> = {}
  if (!Array.isArray(phaseBreakdown) || phaseBreakdown.length === 0 || totalFrames <= 0) {
    return windows
  }

  const sortedPhases = [...phaseBreakdown].sort((a, b) =>
    (a?.sequence_order || 0) - (b?.sequence_order || 0)
  )

  const normalizedPhases = sortedPhases.map((phase, index) => {
    const weight = Number.isFinite(phase?.proportion_weight) ? Number(phase.proportion_weight) : 0
    return {
      id: typeof phase?.id === 'string' ? phase.id : `phase-${index + 1}`,
      name: typeof phase?.name === 'string' ? phase.name : `Phase ${index + 1}`,
      proportionWeight: weight > 0 ? weight : 0,
      frameBuffer: Number.isFinite(phase?.frame_buffer) ? Math.max(0, Math.round(Number(phase.frame_buffer))) : Math.max(0, Math.round(frameBuffer)),
    }
  })

  const totalWeight = normalizedPhases.reduce((sum, phase) => sum + phase.proportionWeight, 0)
  const fallbackWeight = normalizedPhases.length > 0 ? 1 / normalizedPhases.length : 0
  const weightedPhases = normalizedPhases.map((phase) => {
    const normalizedWeight = totalWeight > 0 ? phase.proportionWeight / totalWeight : fallbackWeight
    const exactFrames = normalizedWeight * totalFrames
    const baseFrames = Math.floor(exactFrames)
    return {
      ...phase,
      exactFrames,
      baseFrames,
      remainder: exactFrames - baseFrames,
    }
  })

  let remainingFrames = totalFrames - weightedPhases.reduce((sum, phase) => sum + phase.baseFrames, 0)
  const allocationOrder = weightedPhases
    .map((phase, index) => ({ index, remainder: phase.remainder }))
    .sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder
      return a.index - b.index
    })

  for (let index = 0; index < allocationOrder.length && remainingFrames > 0; index += 1) {
    weightedPhases[allocationOrder[index].index].baseFrames += 1
    remainingFrames -= 1
  }

  let nextStartFrame = 0
  const baseWindows = weightedPhases.map((phase) => {
    const startFrame = nextStartFrame
    const endFrame = Math.max(startFrame - 1, startFrame + phase.baseFrames - 1)
    nextStartFrame = endFrame + 1

    return {
      ...phase,
      startFrame,
      endFrame,
    }
  })

  if (baseWindows.length > 0) {
    baseWindows[0].startFrame = 0
    baseWindows[baseWindows.length - 1].endFrame = totalFrames - 1
  }

  const finalWindows = baseWindows.map((phase, index) => {
    let startFrame = phase.startFrame
    let endFrame = phase.endFrame
    let leftBoundaryBuffer = 0
    let rightBoundaryBuffer = 0

    if (index > 0) {
      const leftPhase = baseWindows[index - 1]
      const boundaryBuffer = Math.max(leftPhase.frameBuffer, phase.frameBuffer, Math.max(0, Math.round(frameBuffer)))
      leftBoundaryBuffer = boundaryBuffer
      startFrame -= boundaryBuffer
    }

    if (index < baseWindows.length - 1) {
      const rightPhase = baseWindows[index + 1]
      const boundaryBuffer = Math.max(phase.frameBuffer, rightPhase.frameBuffer, Math.max(0, Math.round(frameBuffer)))
      rightBoundaryBuffer = boundaryBuffer
      endFrame += boundaryBuffer
    }

    const clampedStart = clampFrame(startFrame, totalFrames)
    const clampedEnd = clampFrame(endFrame, totalFrames)

    return {
      ...phase,
      startFrame: clampedStart,
      endFrame: clampedEnd,
      leftBoundaryBuffer,
      rightBoundaryBuffer,
      wasClamped: clampedStart !== startFrame || clampedEnd !== endFrame,
    }
  })

  for (const phase of finalWindows) {
    windows[phase.id] = {
      start: phase.startFrame,
      end: phase.endFrame,
    }
  }

  const baseSummary = baseWindows
    .map((phase) => `${phase.name} (${phase.startFrame}-${phase.endFrame})`)
    .join(', ')
  const finalSummary = finalWindows
    .map((phase) => `${phase.name} (${phase.startFrame}-${phase.endFrame})`)
    .join(', ')

  logInfo('phase_base_windows_calculated', {
    totalFrames,
    message: `Phase base windows calculated: ${baseSummary}`,
    phases: baseWindows.map((phase) => ({
      id: phase.id,
      name: phase.name,
      proportionWeight: phase.proportionWeight,
      baseFrames: phase.baseFrames,
      start: phase.startFrame,
      end: phase.endFrame,
    })),
  })

  logInfo('phase_windows_built', {
    totalFrames,
    message: `Phase frame windows calculated: ${finalSummary} (with frame_buffer applied)`,
    phases: finalWindows.map((phase, index) => ({
      id: phase.id,
      name: phase.name,
      proportionWeight: phase.proportionWeight,
      frameBuffer: phase.frameBuffer,
      leftBoundaryBuffer: phase.leftBoundaryBuffer,
      rightBoundaryBuffer: phase.rightBoundaryBuffer,
      start: phase.startFrame,
      end: phase.endFrame,
      baseStart: baseWindows[index]?.startFrame ?? null,
      baseEnd: baseWindows[index]?.endFrame ?? null,
      clamped: phase.wasClamped,
    })),
  })

  return windows
}


async function calculateAllMetrics(
  metrics: any[],
  keypoints: VideoKeypoints,
  scores: VideoScores,
  phaseWindows: Record<string, any>,
  personIndex: number,
  calibration: ResolvedCalibration,
  fallbackBehavior: ReferenceFallbackBehavior,
  context: any,
  fps: number,
  uploadId?: string | null
) {
  const results: any[] = []

  // Filter out metrics flagged as inactive (preserved in storage, excluded from scoring)
  const activeMetrics = (metrics ?? []).filter((m: any) => m?.active !== false)

  for (const metric of activeMetrics) {
    const mapping = metric.keypoint_mapping
    const metricContext = {
      uploadId,
      metricId: metric.id,
      metricName: metric.name,
      calculationType: mapping?.calculation_type || 'unknown',
      phaseId: mapping?.phase_id || null,
    }

    // Skip catch-dependent metrics if no catch
    if (metric.requires_catch && context.catch_included === false) {
      logInfo('metric_skipped', { ...metricContext, reason: 'no_catch' })
      results.push({ ...metric, status: 'skipped', reason: 'no_catch' })
      continue
    }

    if (!mapping?.keypoint_indices?.length) {
      logWarn('metric_skipped', { ...metricContext, reason: 'no_keypoint_mapping' })
      results.push({ ...metric, status: 'skipped', reason: 'no_keypoint_mapping' })
      continue
    }

    // Get phase frames
    const window = phaseWindows[mapping.phase_id]
    if (!window) {
      logWarn('metric_skipped', { ...metricContext, reason: 'no_phase_window' })
      results.push({ ...metric, status: 'skipped', reason: 'no_phase_window' })
      continue
    }

    // Extract phase keypoints
    const phaseFrames = keypoints.slice(window.start, window.end + 1)
    const phaseScores = scores.slice(window.start, window.end + 1)
    const bilateralDecision = resolveBilateralSelection(
      mapping,
      context.route_direction,
      phaseFrames,
      phaseScores,
      personIndex,
      metric.name,
      phaseNameById.get(mapping.phase_id) ?? null,
    )
    logInfo('metric_window_selected', {
      ...metricContext,
      side: bilateralDecision.side,
      bilateralSource: bilateralDecision.source,
      windowStart: window.start,
      windowEnd: window.end,
      frameCount: phaseFrames.length,
      keypointIndices: bilateralDecision.effectiveIndices,
      baseKeypointIndices: bilateralDecision.baseIndices,
      leftIndices: bilateralDecision.leftIndices,
      rightIndices: bilateralDecision.rightIndices,
      leftAverageConfidence: bilateralDecision.leftAverageConfidence,
      rightAverageConfidence: bilateralDecision.rightAverageConfidence,
      temporalWindow: mapping.temporal_window || null,
      confidenceThreshold: mapping.confidence_threshold || 0.7,
    })

    // Check confidence
    const confidenceCheck = checkConfidence(
      phaseFrames, phaseScores, personIndex,
      bilateralDecision.effectiveIndices, metric.name, mapping.confidence_threshold || 0.70,
      typeof mapping.min_pass_ratio === 'number' ? mapping.min_pass_ratio : DEFAULT_MIN_PASS_RATIO,
    )

    if (!confidenceCheck.passed) {
      logWarn('metric_flagged', {
        ...metricContext,
        reason: 'low_confidence',
        confidenceDiagnostics: confidenceCheck.diagnostics,
      })
      results.push({
        ...metric,
        status: 'flagged',
        reason: 'low_confidence',
        detail: { confidenceDiagnostics: confidenceCheck.diagnostics },
      })
      continue
    }

    // Per-frame height scale: use the median scale across this phase window.
    const windowPpy = calibration.perFrame ? windowScale(calibration.perFrame, window.start, window.end) : null
    const metricCalibration: ResolvedCalibration = windowPpy !== null
      ? { ...calibration, pixelsPerYard: windowPpy, details: { ...calibration.details, windowPixelsPerYard: windowPpy, windowStart: window.start, windowEnd: window.end } }
      : calibration

    // Calculate based on type
    let metricValue: MetricValueResult = { value: null, reason: 'unsupported_calculation_type' }
    
    switch (mapping.calculation_type) {
      case 'angle':
        metricValue = calculateAngle(phaseFrames, personIndex, bilateralDecision.effectiveIndices, phaseScores, mapping.confidence_threshold || 0.70)
        break
      case 'distance':
        metricValue = calculateDistance(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          metricCalibration,
          fallbackBehavior,
          phaseScores, mapping.confidence_threshold || 0.70,
        )
        break
      case 'velocity':
        metricValue = calculateVelocity(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          mapping.temporal_window || 3, fps, metricCalibration, fallbackBehavior,
          phaseScores, mapping.confidence_threshold || 0.70,
        )
        break
      case 'acceleration':
        metricValue = calculateAcceleration(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          mapping.temporal_window || 5, fps, metricCalibration, fallbackBehavior
        )
        break
      case 'frame_delta':
        metricValue = calculateFrameDelta(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          mapping.temporal_window || 10
        )
        break
      case 'distance_variance':
        metricValue = calculateDistanceVariance(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          mapping.temporal_window || 10, metricCalibration, fallbackBehavior, metric.name
        )
        break
    }

    if (metricValue.status === 'skipped') {
      logInfo('metric_skipped', {
        ...metricContext,
        reason: metricValue.reason || 'skipped',
        detail: {
          ...(metricValue.detail || {}),
          confidenceDiagnostics: confidenceCheck.diagnostics,
          bilateralDecision,
        },
      })
      results.push({
        ...metric,
        status: 'skipped',
        reason: metricValue.reason || 'skipped',
        detail: {
          ...(metricValue.detail || {}),
          confidenceDiagnostics: confidenceCheck.diagnostics,
          bilateralDecision,
        },
      })
      continue
    }

    if (metricValue.value === null) {
      logWarn('metric_failed', {
        ...metricContext,
        reason: metricValue.reason || 'calculation_failed',
        detail: {
          ...(metricValue.detail || {}),
          confidenceDiagnostics: confidenceCheck.diagnostics,
          bilateralDecision,
        },
      })
      results.push({
        ...metric,
        status: 'failed',
        reason: metricValue.reason || 'calculation_failed',
        detail: {
          ...(metricValue.detail || {}),
          confidenceDiagnostics: confidenceCheck.diagnostics,
        },
      })
      continue
    }

    // Physical plausibility: out-of-range values are never scored.
    const plausibility = checkPlausibility(metric.name, metric.unit || '', metricValue.value)
    if (!plausibility.ok) {
      const implausibleDetail = {
        ...(metricValue.detail || {}),
        raw_value: metricValue.value,
        plausible_range: plausibility.range,
        confidenceDiagnostics: confidenceCheck.diagnostics,
        bilateralDecision,
      }
      logWarn('metric_skipped', { ...metricContext, reason: 'implausible_value', detail: implausibleDetail })
      results.push({
        ...metric,
        status: 'skipped',
        reason: 'implausible_value',
        detail: implausibleDetail,
      })
      continue
    }

    // Score the metric
    const score = scoreMetric(metricValue.value, metric.eliteTarget, metric.tolerance)
    logInfo('metric_scored', {
      ...metricContext,
      value: metricValue.value,
      eliteTarget: metric.eliteTarget,
      tolerance: metric.tolerance,
      score,
      detail: {
        ...(metricValue.detail || {}),
        confidenceDiagnostics: confidenceCheck.diagnostics,
        bilateralDecision,
      },
    })

    results.push({
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      value: Math.round(metricValue.value * 100) / 100,
      elite_target: metric.eliteTarget,
      tolerance: metric.tolerance,
      deviation: Math.abs(metricValue.value - metric.eliteTarget),
      score,
      weight: metric.weight,
      status: 'scored',
      detail: {
        ...(metricValue.detail || {}),
        confidenceDiagnostics: confidenceCheck.diagnostics,
        bilateralDecision,
      },
      keypoint_mapping: metric.keypoint_mapping,
    })
  }

  return results
}

// ANGLE: geometric angle at vertex (middle keypoint)
// keypoints order: endpoint → vertex → endpoint
// Frames around the phase midpoint (±2) whose keypoints all pass confidence.
function collectMidWindowFrames(
  frames: VideoKeypoints, scores: VideoScores | undefined, personIdx: number,
  indices: number[], threshold: number | undefined,
): Array<{ frame: number; points: Point[] }> {
  const midFrame = Math.floor(frames.length / 2)
  const out: Array<{ frame: number; points: Point[] }> = []
  for (let f = Math.max(0, midFrame - 2); f <= Math.min(frames.length - 1, midFrame + 2); f++) {
    const kps = frames[f]?.[personIdx]
    if (!kps) continue
    const personScores = scores?.[f]?.[personIdx]
    const points = indices.map(i => kps[i])
    const ok = indices.every((i, n) => isValidScoredPoint(points[n], personScores?.[i], scores ? threshold : undefined))
    if (ok) out.push({ frame: f, points })
  }
  return out
}

function calculateAngle(
  frames: VideoKeypoints, personIdx: number, indices: number[],
  scores?: VideoScores, threshold?: number,
): MetricValueResult {
  const midFrame = Math.floor(frames.length / 2)
  if (!frames[midFrame]?.[personIdx]) return { value: null, reason: 'no_person_frames', detail: { midFrame, personIdx } }
  const valid = collectMidWindowFrames(frames, scores, personIdx, indices, threshold)
  if (valid.length === 0) {
    return { value: null, reason: 'insufficient_valid_frames', detail: { midFrame, indices } }
  }
  const angles: number[] = []
  for (const { points: [p1, vertex, p2] } of valid) {
    const v1 = [p1[0] - vertex[0], p1[1] - vertex[1]]
    const v2 = [p2[0] - vertex[0], p2[1] - vertex[1]]
    const mag1 = Math.sqrt(v1[0]**2 + v1[1]**2)
    const mag2 = Math.sqrt(v2[0]**2 + v2[1]**2)
    if (mag1 === 0 || mag2 === 0) continue
    const dot = v1[0]*v2[0] + v1[1]*v2[1]
    angles.push(Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI))
  }
  const value = median(angles)
  if (value === null) return { value: null, reason: 'zero_magnitude_angle', detail: { midFrame, indices } }
  return {
    value,
    detail: { midFrame, indices, framesUsed: valid.map(v => v.frame), method: 'median_mid_window' },
  }
}

// DISTANCE: Euclidean pixel distance converted to yards (median of mid-window frames)
function calculateDistance(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], calibration: ResolvedCalibration, fallbackBehavior: ReferenceFallbackBehavior,
  scores?: VideoScores, threshold?: number,
): MetricValueResult {
  const midFrame = Math.floor(frames.length / 2)
  if (!frames[midFrame]?.[personIdx]) return { value: null, reason: 'no_person_frames', detail: { midFrame, personIdx } }
  const valid = collectMidWindowFrames(frames, scores, personIdx, indices.slice(0, 2), threshold)
  if (valid.length === 0) return { value: null, reason: 'insufficient_valid_frames', detail: { midFrame, indices } }
  const pixelDist = median(valid.map(({ points: [p1, p2] }) => Math.sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2))) as number
  const framesUsed = valid.map(v => v.frame)
  const calibrationDetail = getCalibrationMetricDetail(calibration)

  if (!calibration.pixelsPerYard || calibration.pixelsPerYard <= 0) {
    if (fallbackBehavior === 'disable_distance') {
      return {
        value: null,
        status: 'skipped',
        reason: 'no_calibration_available',
        detail: { midFrame, indices, framesUsed, pixelDistance: pixelDist, ...calibrationDetail },
      }
    }
    return {
      value: pixelDist,
      reason: 'missing_calibration',
      detail: { midFrame, indices, framesUsed, pixelDistance: pixelDist, warning: 'uncalibrated_pixel_value', ...calibrationDetail },
    }
  }

  return {
    value: pixelDist / calibration.pixelsPerYard,
    detail: { midFrame, indices, framesUsed, pixelDistance: pixelDist, pixelsPerYard: calibration.pixelsPerYard, ...calibrationDetail },
  }
}

// VELOCITY: net phase displacement / elapsed time → mph
// Measures the net displacement of the keypoint midpoint between the first and
// last confidence-valid frames across the WHOLE phase window. temporalWindow is
// the minimum elapsed-frame span required; shorter spans are skipped instead of
// letting a single frame-pair jump define the metric.
function calculateVelocity(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], temporalWindow: number, fps: number, calibration: ResolvedCalibration, fallbackBehavior: ReferenceFallbackBehavior,
  scores?: VideoScores, threshold?: number,
): MetricValueResult {
  const window = frames
  const minElapsed = Math.max(2, temporalWindow)
  if (window.length < 2) {
    return {
      value: null,
      reason: 'insufficient_temporal_window',
      detail: { requestedWindow: temporalWindow, actualWindow: window.length },
    }
  }

  const calibrationDetail = getCalibrationMetricDetail(calibration)
  const midpointAt = (f: number): Point | null => {
    const person = window[f]?.[personIdx]
    if (!person) return null
    return getMidpoint(person, indices, scores?.[f]?.[personIdx], threshold)
  }

  let firstIdx = -1
  let firstPos: Point | null = null
  for (let f = 0; f < window.length; f++) {
    const pos = midpointAt(f)
    if (!pos) continue
    firstIdx = f
    firstPos = pos
    break
  }

  let lastIdx = -1
  let lastPos: Point | null = null
  for (let f = window.length - 1; f > firstIdx; f--) {
    const pos = midpointAt(f)
    if (!pos) continue
    lastIdx = f
    lastPos = pos
    break
  }

  if (firstPos === null || lastPos === null || lastIdx - firstIdx < minElapsed) {
    return {
      value: null,
      status: 'skipped',
      reason: 'insufficient_valid_frames',
      detail: {
        temporalWindow,
        minElapsedFrames: minElapsed,
        indices,
        personIdx,
        actualWindow: window.length,
        firstFrameIndex: firstIdx,
        lastFrameIndex: lastIdx,
        method: 'net_phase_displacement',
      },
    }
  }

  const netDisplacementPixels = Math.sqrt(
    (lastPos[0] - firstPos[0]) ** 2 + (lastPos[1] - firstPos[1]) ** 2
  )
  const elapsedFrames = lastIdx - firstIdx
  const elapsedSeconds = elapsedFrames / fps
  const pixelsPerSecond = elapsedSeconds > 0 ? netDisplacementPixels / elapsedSeconds : 0

  const baseDetail = {
    temporalWindow,
    indices,
    fps,
    method: 'net_phase_displacement',
    actualWindow: window.length,
    firstFrameIndex: firstIdx,
    lastFrameIndex: lastIdx,
    elapsedFrames,
    elapsedSeconds,
    netDisplacementPixels,
    rawPixelsPerSecond: pixelsPerSecond,
    pixelsPerYard: calibration.pixelsPerYard,
    ...calibrationDetail,
  }

  const mph = pixelsPerSecondToMph(pixelsPerSecond, calibration.pixelsPerYard)

  if (mph === null) {
    if (fallbackBehavior === 'disable_distance') {
      return {
        value: null,
        status: 'skipped',
        reason: 'no_calibration_available',
        detail: { ...baseDetail, personIdx },
      }
    }

    return {
      value: pixelsPerSecond,
      reason: 'missing_calibration',
      detail: { ...baseDetail, personIdx, warning: 'uncalibrated_pixel_value' },
    }
  }

  return {
    value: mph,
    detail: baseDetail,
  }
}

// ACCELERATION: velocity delta over temporal window
function calculateAcceleration(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], temporalWindow: number, fps: number, calibration: ResolvedCalibration, fallbackBehavior: ReferenceFallbackBehavior
) : MetricValueResult {
  if (frames.length < temporalWindow) {
    return {
      value: null,
      reason: 'insufficient_temporal_window',
      detail: { temporalWindow, availableFrames: frames.length },
    }
  }
  
  const v1 = calculateVelocity(frames.slice(0, Math.floor(temporalWindow/2)), personIdx, indices, 3, fps, calibration, fallbackBehavior)
  const v2 = calculateVelocity(frames.slice(Math.floor(temporalWindow/2)), personIdx, indices, 3, fps, calibration, fallbackBehavior)
  
  if (v1.status === 'skipped' || v2.status === 'skipped') {
    return {
      value: null,
      status: 'skipped',
      reason: 'no_calibration_available',
      detail: { firstHalf: v1.detail, secondHalf: v2.detail, temporalWindow, ...getCalibrationMetricDetail(calibration) },
    }
  }

  if (v1.value === null || v2.value === null) {
    return {
      value: null,
      reason: v1.reason || v2.reason || 'no_velocity_samples',
      detail: { firstHalf: v1.detail, secondHalf: v2.detail, temporalWindow },
    }
  }
  
  const timeSeconds = (temporalWindow / 2) / fps
  return {
    value: (v2.value - v1.value) / timeSeconds,
    detail: {
      temporalWindow,
      timeSeconds,
      firstVelocity: v1.value,
      secondVelocity: v2.value,
      pixelsPerYard: calibration.pixelsPerYard,
      firstVelocityDetail: v1.detail,
      secondVelocityDetail: v2.detail,
      ...getCalibrationMetricDetail(calibration),
    },
  }
}

// FRAME DELTA: frames between two keypoint events
function calculateFrameDelta(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], temporalWindow: number
): MetricValueResult {
  // Index 0 = anchor keypoint (e.g. Left Heel for heel plant)
  // Index 1 = event keypoint (e.g. Nose for head snap)
  
  let anchorFrame: number | null = null
  let eventFrame: number | null = null

  for (let f = 0; f < Math.min(frames.length, temporalWindow); f++) {
    const kps = frames[f]?.[personIdx]
    if (!kps) continue

    const anchor = kps[indices[0]]
    const eventKp = kps[indices[1]]

    // Detect heel plant: Y-coordinate local minimum
    if (anchorFrame === null && f > 0 && f < frames.length - 1) {
      const prevY = frames[f-1]?.[personIdx]?.[indices[0]]?.[1]
      const currY = anchor?.[1]
      const nextY = frames[f+1]?.[personIdx]?.[indices[0]]?.[1]
      if (prevY && currY && nextY && currY < prevY && currY < nextY) {
        anchorFrame = f
      }
    }

    // Detect head snap: X-velocity exceeds threshold after anchor
    if (anchorFrame !== null && eventFrame === null && f > anchorFrame && f > 0) {
      const prevX = frames[f-1]?.[personIdx]?.[indices[1]]?.[0]
      const currX = eventKp?.[0]
      if (prevX && currX && Math.abs(currX - prevX) > 3) { // 3px threshold
        eventFrame = f
      }
    }
  }

  if (anchorFrame === null) {
    return {
      value: null,
      reason: 'anchor_event_not_found',
      detail: { temporalWindow, indices, personIdx },
    }
  }
  if (eventFrame === null) {
    return {
      value: null,
      reason: 'target_event_not_found',
      detail: { temporalWindow, indices, personIdx, anchorFrame },
    }
  }
  return {
    value: eventFrame - anchorFrame,
    detail: { temporalWindow, indices, personIdx, anchorFrame, eventFrame },
  }
}

// DISTANCE VARIANCE: standard deviation of inter-keypoint distance across the
// temporal window. Low value = stable (e.g. hips remain composed during a cut),
// high value = unstable (rocking, leaning, posture loss). Computed in yards
// when calibration is available; falls back to pixel std-dev with a warning
// flag when not, matching the calibration-fallback pattern of calculateDistance.
function calculateDistanceVariance(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], temporalWindow: number,
  calibration: ResolvedCalibration, fallbackBehavior: ReferenceFallbackBehavior,
  metricName: string
): MetricValueResult {
  if (indices.length < 2) {
    return {
      value: null,
      reason: 'distance_variance_requires_two_indices',
      detail: { indices },
    }
  }

  const window = frames.slice(0, Math.min(temporalWindow, frames.length))
  if (window.length < 5) {
    return {
      value: null,
      reason: 'insufficient_temporal_window',
      detail: { requestedWindow: temporalWindow, actualWindow: window.length, minimum: 5 },
    }
  }

  const pixelDistances: number[] = []
  for (const frame of window) {
    const kps = frame?.[personIdx]
    if (!kps) continue
    const p1 = kps[indices[0]]
    const p2 = kps[indices[1]]
    if (!p1 || !p2 || p1[0] <= 0 || p2[0] <= 0) continue
    pixelDistances.push(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]))
  }

  if (pixelDistances.length < 5) {
    return {
      value: null,
      reason: 'insufficient_valid_frames',
      detail: { temporalWindow, validFrames: pixelDistances.length, minimum: 5 },
    }
  }

  const pixelStdDev = standardDeviation(pixelDistances)
  const pixelMean = average(pixelDistances)
  const pixelMin = Math.min(...pixelDistances)
  const pixelMax = Math.max(...pixelDistances)
  const calibrationDetail = getCalibrationMetricDetail(calibration)

  const observability = {
    metricName,
    framesUsed: pixelDistances.length,
    pixelStdDev: Number(pixelStdDev.toFixed(3)),
    pixelMean: Number(pixelMean.toFixed(3)),
    pixelMin: Number(pixelMin.toFixed(3)),
    pixelMax: Number(pixelMax.toFixed(3)),
    indices,
    pixelsPerYard: calibration.pixelsPerYard,
  }

  if (!calibration.pixelsPerYard || calibration.pixelsPerYard <= 0) {
    if (fallbackBehavior === 'disable_distance') {
      logInfo('distance_variance_calculated', { ...observability, status: 'skipped', reason: 'no_calibration_available' })
      return {
        value: null,
        status: 'skipped',
        reason: 'no_calibration_available',
        detail: { ...observability, ...calibrationDetail },
      }
    }
    logInfo('distance_variance_calculated', { ...observability, warning: 'uncalibrated_pixel_value' })
    return {
      value: pixelStdDev,
      reason: 'missing_calibration',
      detail: { ...observability, warning: 'uncalibrated_pixel_value', ...calibrationDetail },
    }
  }

  const yardStdDev = pixelStdDev / calibration.pixelsPerYard
  const yardMean = pixelMean / calibration.pixelsPerYard
  const yardMin = pixelMin / calibration.pixelsPerYard
  const yardMax = pixelMax / calibration.pixelsPerYard

  logInfo('distance_variance_calculated', {
    ...observability,
    stdDev_yd: Number(yardStdDev.toFixed(4)),
    mean_yd: Number(yardMean.toFixed(4)),
    min_yd: Number(yardMin.toFixed(4)),
    max_yd: Number(yardMax.toFixed(4)),
    range_yd: Number((yardMax - yardMin).toFixed(4)),
  })

  return {
    value: yardStdDev,
    detail: {
      ...observability,
      stdDev_yd: yardStdDev,
      mean_yd: yardMean,
      min_yd: yardMin,
      max_yd: yardMax,
      range_yd: yardMax - yardMin,
      ...calibrationDetail,
    },
  }
}

// HELPERS
function isValidScoredPoint(p: Point | undefined, score: number | undefined, threshold: number | undefined): p is Point {
  if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[0] <= 0 || p[1] <= 0) return false
  if (threshold !== undefined && (typeof score !== 'number' || score < threshold)) return false
  return true
}

function getMidpoint(kps: PersonKeypoints, indices: number[], personScores?: PersonScores, threshold?: number): Point | null {
  if (indices.some(i => !isValidScoredPoint(kps[i], personScores?.[i], personScores ? threshold : undefined))) return null
  const points = indices.map(i => kps[i])
  if (points.length === 0) return null
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length
  ]
}

function checkConfidence(
  frames: VideoKeypoints, scores: VideoScores,
  personIdx: number, indices: number[], metricName: string, threshold: number,
  minPassRatio: number = DEFAULT_MIN_PASS_RATIO,
): ConfidenceCheckResult {
  let totalChecks = 0
  let passedChecks = 0
  let framesWithMissingKeypoints = 0
  const perKeypointTotals: Record<number, number> = {}
  const perKeypointCounts: Record<number, number> = {}

  for (const index of indices) {
    perKeypointTotals[index] = 0
    perKeypointCounts[index] = 0
  }
  
  for (let frameIndex = 0; frameIndex < scores.length; frameIndex++) {
    const frameScores = scores[frameIndex]
    const personScores = frameScores[personIdx]
    const frameKeypoints = frames[frameIndex]?.[personIdx]
    let frameMissingKeypoint = false

    if (!personScores || !frameKeypoints) {
      framesWithMissingKeypoints++
      continue
    }

    for (const idx of indices) {
      totalChecks++
      const score = personScores[idx] || 0
      const keypoint = frameKeypoints[idx]
      perKeypointTotals[idx] += score
      perKeypointCounts[idx] += 1

      if (!keypoint || keypoint[0] == null || keypoint[1] == null) {
        frameMissingKeypoint = true
      }

      if (score >= threshold) passedChecks++
    }

    if (frameMissingKeypoint) {
      framesWithMissingKeypoints++
    }
  }

  const perKeypointAvgConfidence = Object.fromEntries(
    Object.entries(perKeypointTotals).map(([idx, total]) => {
      const count = perKeypointCounts[Number(idx)] || 0
      return [idx, count > 0 ? total / count : 0]
    })
  ) as Record<string, number>

  const lowestConfidenceEntry = Object.entries(perKeypointAvgConfidence).reduce<[string, number] | null>((lowest, entry) => {
    if (!lowest || entry[1] < lowest[1]) return [entry[0], entry[1]]
    return lowest
  }, null)

  const passRatio = totalChecks === 0 ? 1 : passedChecks / totalChecks
  const diagnostics: ConfidenceDiagnostics = {
    total_frames_in_window: frames.length,
    total_keypoint_checks: totalChecks,
    passed_checks: passedChecks,
    pass_ratio: passRatio,
    threshold: minPassRatio,
    confidence_threshold: threshold,
    per_keypoint_avg_confidence: perKeypointAvgConfidence,
    lowest_confidence_keypoint: lowestConfidenceEntry ? Number(lowestConfidenceEntry[0]) : null,
    frames_with_missing_keypoints: framesWithMissingKeypoints,
  }

  logInfo('metric_confidence_evaluated', {
    metric_name: metricName,
    ...diagnostics,
  })

  return {
    passed: passesWindowGate(passRatio, minPassRatio),
    diagnostics,
  }
}

function buildMirrorIndexMap(): Map<number, number> {
  // MediaPipe Pose 33-landmark mirror pairs.
  // CONTRACT: each pair MUST be ordered [leftIndex, rightIndex] where leftIndex < rightIndex.
  //   `mapIndicesToSide` relies on this ordering (via `index < mirrored`) to identify which
  //   side a base index belongs to. See Ticket 7 backlog: refactor to explicit left/right
  //   sets to remove the L<R ordering coupling.
  // Source of truth: src/constants/keypointLibrary.json → mirror_pairs.
  // Sync manually if the MediaPipe schema changes.
  const mirrorPairs: Array<[number, number]> = [
    [1, 4], [2, 5], [3, 6], [7, 8], [9, 10],
    [11, 12], [13, 14], [15, 16],
    [17, 18], [19, 20], [21, 22],
    [23, 24], [25, 26], [27, 28],
    [29, 30], [31, 32],
  ]

  const mirrorMap = new Map<number, number>()
  for (const [leftIndex, rightIndex] of mirrorPairs) {
    mirrorMap.set(leftIndex, rightIndex)
    mirrorMap.set(rightIndex, leftIndex)
  }
  return mirrorMap
}

function mapIndicesToSide(indices: number[], side: BilateralSide): number[] {
  return indices.map((index) => {
    const mirrored = MIRROR_INDEX_BY_INDEX.get(index)
    if (!mirrored) return index
    const isLeftBase = index < mirrored
    if (side === 'left') return isLeftBase ? index : mirrored
    return isLeftBase ? mirrored : index
  })
}

function averageConfidenceForIndices(
  frames: VideoKeypoints,
  scores: VideoScores,
  personIdx: number,
  indices: number[],
): number | null {
  let total = 0
  let count = 0

  for (let frameIndex = 0; frameIndex < scores.length; frameIndex++) {
    const personScores = scores[frameIndex]?.[personIdx]
    const personKeypoints = frames[frameIndex]?.[personIdx]
    if (!personScores || !personKeypoints) continue

    for (const index of indices) {
      const keypoint = personKeypoints[index]
      const confidence = personScores[index]
      if (!keypoint || !Number.isFinite(confidence)) continue
      total += confidence
      count += 1
    }
  }

  return count > 0 ? total / count : null
}

function chooseBestBilateralSide(
  metricName: string,
  keypoints: VideoKeypoints,
  scores: VideoScores,
  personIdx: number,
  leftIndices: number[],
  rightIndices: number[],
): Pick<BilateralDecision, 'side' | 'leftAverageConfidence' | 'rightAverageConfidence'> {
  const leftAverageConfidence = averageConfidenceForIndices(keypoints, scores, personIdx, leftIndices)
  const rightAverageConfidence = averageConfidenceForIndices(keypoints, scores, personIdx, rightIndices)
  const safeLeftConfidence = leftAverageConfidence ?? 0
  const safeRightConfidence = rightAverageConfidence ?? 0
  const side: BilateralSide = safeLeftConfidence >= safeRightConfidence ? 'left' : 'right'

  return { side, leftAverageConfidence, rightAverageConfidence }
}

function logBilateralDecision(
  metricName: string,
  source: BilateralDecisionSource,
  side: BilateralSide,
  leftIndices: number[],
  rightIndices: number[],
  effectiveIndices: number[],
  leftAverageConfidence: number | null,
  rightAverageConfidence: number | null,
) {
  const safeLeftConfidence = leftAverageConfidence ?? 0
  const safeRightConfidence = rightAverageConfidence ?? 0
  logInfo('bilateral_side_selected', {
    metricName,
    source,
    side,
    leftIndices,
    rightIndices,
    effectiveIndices,
    leftAverageConfidence,
    rightAverageConfidence,
    message: `Bilateral for ${metricName}: chose ${side} via ${source} (conf left: ${safeLeftConfidence.toFixed(2)} vs right: ${safeRightConfidence.toFixed(2)})`,
  })
}

function resolveBilateralSelection(
  mapping: BilateralMappingInput,
  routeDirection: unknown,
  phaseFrames: VideoKeypoints,
  phaseScores: VideoScores,
  personIdx: number,
  metricName: string,
  phaseName: string | null = null,
): BilateralDecision {
  const baseIndices = Array.isArray(mapping.keypoint_indices) ? mapping.keypoint_indices : []
  const leftIndices = mapIndicesToSide(baseIndices, 'left')
  const rightIndices = mapIndicesToSide(baseIndices, 'right')
  const routeSide = routeDirection === 'left' || routeDirection === 'right' ? routeDirection : null
  const bilateralOverride = mapping.bilateral_override ?? 'auto'
  const bilateralMode = mapping.bilateral ?? 'auto'

  if (bilateralOverride === 'force_left' || bilateralOverride === 'force_right') {
    const side: BilateralSide = bilateralOverride === 'force_left' ? 'left' : 'right'
    const effectiveIndices = side === 'left' ? leftIndices : rightIndices
    logBilateralDecision(metricName, 'override', side, leftIndices, rightIndices, effectiveIndices, null, null)
    return {
      side,
      source: 'override',
      baseIndices,
      leftIndices,
      rightIndices,
      effectiveIndices,
      leftAverageConfidence: null,
      rightAverageConfidence: null,
    }
  }

  // bilateral: "none" — metric's keypoint_indices already span both sides
  // (e.g. [23,24] hips, [27,28] ankles, [19,20] index fingers). Use base indices
  // verbatim; do NOT mirror or pick a single side. Must be checked before
  // route/auto branches so bilateral pairs aren't collapsed.
  if (bilateralOverride === 'none' || bilateralMode === 'none') {
    logBilateralDecision(metricName, 'override', 'left', leftIndices, rightIndices, baseIndices, null, null)
    return {
      side: 'left',
      source: 'override',
      baseIndices,
      leftIndices,
      rightIndices,
      effectiveIndices: baseIndices,
      leftAverageConfidence: null,
      rightAverageConfidence: null,
    }
  }

  if (bilateralMode === 'left' || bilateralMode === 'right') {
    const side: BilateralSide = bilateralMode
    const effectiveIndices = side === 'left' ? leftIndices : rightIndices
    logBilateralDecision(metricName, 'fixed_bilateral', side, leftIndices, rightIndices, effectiveIndices, null, null)
    return {
      side,
      source: 'fixed_bilateral',
      baseIndices,
      leftIndices,
      rightIndices,
      effectiveIndices,
      leftAverageConfidence: null,
      rightAverageConfidence: null,
    }
  }

  if (routeSide) {
    const sideRule = resolveSideRule({
      sideRule: mapping.side_rule,
      calculationType: mapping.calculation_type,
      keypointIndices: baseIndices,
      phaseName,
    })
    const side = sideForRoute(routeSide, sideRule.rule)
    const effectiveIndices = side === 'left' ? leftIndices : rightIndices
    logBilateralDecision(metricName, 'route_direction', side, leftIndices, rightIndices, effectiveIndices, null, null)
    return {
      side_rule: sideRule.rule,
      side_rule_source: sideRule.source,
      side,
      source: 'route_direction',
      baseIndices,
      leftIndices,
      rightIndices,
      effectiveIndices,
      leftAverageConfidence: null,
      rightAverageConfidence: null,
    }
  }

  const autoChoice = chooseBestBilateralSide(metricName, phaseFrames, phaseScores, personIdx, leftIndices, rightIndices)
  const effectiveIndices = autoChoice.side === 'left' ? leftIndices : rightIndices
  logBilateralDecision(
    metricName,
    'confidence_auto',
    autoChoice.side,
    leftIndices,
    rightIndices,
    effectiveIndices,
    autoChoice.leftAverageConfidence,
    autoChoice.rightAverageConfidence,
  )
  return {
    side: autoChoice.side,
    source: 'confidence_auto',
    baseIndices,
    leftIndices,
    rightIndices,
    effectiveIndices,
    leftAverageConfidence: autoChoice.leftAverageConfidence,
    rightAverageConfidence: autoChoice.rightAverageConfidence,
  }
}

function scoreMetric(value: number, eliteTarget: number, tolerance: number): number {
  const deviation = Math.abs(value - eliteTarget)
  if (deviation <= tolerance) return 100
  return Math.max(0, 100 - ((deviation - tolerance) / tolerance) * 50)
}

function calculateAggregateScore(
  metricResults: any[],
  nodeConfig: any,
  catchIncluded: boolean
) {
  const scored = metricResults.filter(m => m.status === 'scored')
  const skipped = metricResults.filter(m => m.status === 'skipped')
  const flagged = metricResults.filter(m => m.status === 'flagged')

  // A1: Read scoring config from node columns (correct source of truth) instead
  // of from the legacy `scoring_rules` text blob, which has no parsed fields.
  // Previously this silently fell back to defaults ('skip' / 50) regardless of
  // what admins configured in the editor.
  const confidenceHandling = nodeConfig.confidence_handling || 'skip'
  const renormalize = nodeConfig.scoring_renormalize_on_skip !== false
  const totalMetrics = metricResults.length
  const minThreshold = nodeConfig.min_metrics_threshold ?? 50
  const skippedCountForConfig = skipped.length + (confidenceHandling === 'skip' ? flagged.length : 0)
  const skippedPercentForConfig = totalMetrics > 0
    ? Number(((skippedCountForConfig / totalMetrics) * 100).toFixed(1))
    : 0

  // Snapshot of the scoring config actually applied to this run. Surfaced via
  // logInfo (logs) AND returned to the caller so it can be persisted into
  // log_data.scoring_config for the admin AnalysisLog.
  const scoring_config_applied = {
    confidence_handling: confidenceHandling as 'skip' | 'penalize' | 'flag_only',
    min_metrics_threshold: minThreshold,
    renormalize_on_skip: renormalize,
    total_metrics: totalMetrics,
    scored_count: scored.length,
    flagged_count: flagged.length,
    skipped_count: skipped.length,
    skipped_percent: skippedPercentForConfig,
  }

  logInfo('scoring_config_applied', {
    nodeId: nodeConfig.id,
    nodeName: nodeConfig.name,
    ...scoring_config_applied,
  })

  // Handle flagged metrics based on confidence_handling rule
  const effectiveScored = [...scored]
  for (const metric of flagged) {
    if (confidenceHandling === 'penalize') {
      effectiveScored.push({ ...metric, score: 0, status: 'scored' })
    }
    // 'skip' and 'flag': exclude from aggregate
  }

  if (effectiveScored.length === 0) {
    return { aggregate_score: 0, phase_scores: {}, scoring_config_applied }
  }

  let totalWeight = effectiveScored.reduce((s, m) => s + m.weight, 0)
  let weightedSum = effectiveScored.reduce((s, m) => s + (m.score * m.weight), 0)

  if (skippedPercentForConfig > minThreshold) {
    return {
      aggregate_score: null,
      rejected: true,
      reason: `Too many skipped metrics: ${skippedPercentForConfig.toFixed(0)}% > ${minThreshold}%`,
      scoring_config_applied,
    }
  }

  // Renormalize or cap
  const aggregate_score = renormalize
    ? weightedSum / totalWeight  // normalize to 100
    : weightedSum / 100           // cap at included weight total

  // Phase scores
  const phase_scores: Record<string, number> = {}
  // Group by phase and average
  const phaseGroups: Record<string, any[]> = {}
  for (const m of effectiveScored) {
    const phaseId = m.keypoint_mapping?.phase_id || 'unknown'
    if (!phaseGroups[phaseId]) phaseGroups[phaseId] = []
    phaseGroups[phaseId].push(m)
  }
  for (const [phaseId, metrics] of Object.entries(phaseGroups)) {
    phase_scores[phaseId] = metrics.reduce((s, m) => s + m.score, 0) / metrics.length
  }

  return {
    aggregate_score: Math.round(aggregate_score),
    phase_scores,
    skipped_metrics: skipped.map(m => m.name).join(', '),
    scoring_config_applied,
  }
}


function detectErrors(errors: any[], metricResults: any[]) {
  const evaluations = evaluateErrorRules(errors, metricResults)
  const detected = evaluations
    .filter(e => e.triggered)
    .map(e => ({ name: e.name, condition: e.condition, metric_value: e.metric_value, severity: e.severity }))
  const context = evaluations.filter(e => !e.triggered).map(e => e.name)
  return { detected, context, evaluations }
}

async function callClaude(
  nodeConfig: any,
  scoreResult: any,
  metricResults: any[],
  errorResults: any,
  upload: any,
  context: any
): Promise<ClaudeCallResult> {
  const variables = {
    mastery_score: scoreResult.aggregate_score?.toString() || 'N/A',
    phase_scores: formatPhaseScores(scoreResult.phase_scores, nodeConfig.phase_breakdown),
    metric_results: formatMetricResults(metricResults),
    confidence_flags: formatConfidenceFlags(metricResults),
    detected_errors: errorResults.detected.length > 0
      ? `Confirmed errors observed: ${errorResults.detected.map((e: { name: string }) => e.name).join(', ')}`
      : '',
    athlete_name: context.athlete_name || 'Athlete',
    node_name: nodeConfig.name,
    // A4: position now wired from nodeConfig (was previously omitted, so any
    // {{position}} token in a prompt template silently rendered as the literal
    // placeholder string instead of the node's configured position).
    position: nodeConfig.position || '',
    athlete_level: context.athlete_level || 'high_school',
    focus_area: context.focus_area || '',
    skipped_metrics: formatSkippedMetrics(metricResults),
  }

  // Observability: surface which template variables were resolved with real
  // values vs left empty. Lets admins confirm new vars (e.g. {{position}})
  // are actually wired before they edit prompt templates that rely on them.
  const template = nodeConfig.llm_prompt_template || ''
  logInfo('variables_injected', {
    nodeId: nodeConfig.id,
    template_length: template.length,
    variables: Object.entries(variables).map(([name, value]) => {
      const stringValue = String(value ?? '')
      return {
        name,
        present: stringValue.length > 0,
        used_in_template: template.includes(`{{${name}}}`),
        value_summary: stringValue.length > 80 ? `${stringValue.slice(0, 80)}…` : stringValue,
      }
    }),
  })

  // Inject variables into template
  let prompt = template
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value as string)
  }

  const claudeLog: PipelineLogData['claude_api'] = {
    model: 'claude-sonnet-4-5',
    system_instructions_present: Boolean(nodeConfig.llm_system_instructions),
    system_instructions_chars: typeof nodeConfig.llm_system_instructions === 'string' ? nodeConfig.llm_system_instructions.length : 0,
    variables_injected: Object.entries(variables).map(([name, value]) => ({
      name,
      value_summary: summarizeValue(value),
      present: typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined,
    })),
    missing_variables: Object.entries(variables)
      .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
      .map(([name]) => name),
    template_tokens: Math.ceil((nodeConfig.llm_prompt_template || '').length / 4),
    system_tokens: Math.ceil((nodeConfig.llm_system_instructions || '').length / 4),
    variable_tokens: Math.ceil(Object.values(variables).join(' ').length / 4),
    prompt_tokens: Math.ceil(prompt.length / 4),
    target_words: typeof nodeConfig.llm_max_words === 'number' ? nodeConfig.llm_max_words : undefined,
    status: 'FAILED',
  }

  logInfo('claude_request_prepared', {
    uploadId: upload.id,
    nodeId: nodeConfig.id,
    nodeName: nodeConfig.name,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 500),
  })

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: nodeConfig.llm_max_words ? nodeConfig.llm_max_words * 2 : 500,
        system: nodeConfig.llm_system_instructions || '',
        messages: [{ role: 'user', content: prompt }]
      })
    })
  } catch (error) {
    logWarn('claude_request_failed', {
      uploadId: upload.id,
      nodeId: nodeConfig.id,
      nodeName: nodeConfig.name,
      error: (error as Error).message,
    })
    throw error
  }

  const rawResponseText = await response.text()
  logInfo('claude_response_received', {
    uploadId: upload.id,
    nodeId: nodeConfig.id,
    nodeName: nodeConfig.name,
    status: response.status,
    ok: response.ok,
    rawResponse: rawResponseText.slice(0, 4000),
    rawResponseLength: rawResponseText.length,
  })

  let data: Record<string, unknown>
  try {
    data = JSON.parse(rawResponseText) as Record<string, unknown>
  } catch (error) {
    logWarn('claude_response_parse_failed', {
      uploadId: upload.id,
      nodeId: nodeConfig.id,
      nodeName: nodeConfig.name,
      error: (error as Error).message,
      rawResponse: rawResponseText.slice(0, 4000),
    })
    throw new Error(`Claude response parse failed: ${(error as Error).message}`)
  }

  if (!response.ok) {
    logWarn('claude_request_failed', {
      uploadId: upload.id,
      nodeId: nodeConfig.id,
      nodeName: nodeConfig.name,
      status: response.status,
      rawResponse: rawResponseText.slice(0, 4000),
    })
    throw new Error(`Claude request failed: ${response.status}`)
  }

  const usage = data.usage && typeof data.usage === 'object' ? data.usage as Record<string, unknown> : {}
  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined
  claudeLog.response_tokens = outputTokens
  claudeLog.total_tokens = (inputTokens ?? 0) + (outputTokens ?? 0) || undefined
  if (inputTokens !== undefined) claudeLog.prompt_tokens = inputTokens

  const content = Array.isArray(data.content) ? data.content : []
  const firstBlock = content[0]
  const feedback =
    firstBlock && typeof firstBlock === 'object' && typeof (firstBlock as { text?: unknown }).text === 'string'
      ? (firstBlock as { text: string }).text
      : ''

  if (!feedback) {
    logWarn('claude_response_empty', {
      uploadId: upload.id,
      nodeId: nodeConfig.id,
      nodeName: nodeConfig.name,
      rawResponse: rawResponseText.slice(0, 4000),
    })
  }

  claudeLog.word_count = feedback.trim().length > 0 ? feedback.trim().split(/\s+/).length : 0
  claudeLog.truncated = typeof claudeLog.target_words === 'number' && typeof claudeLog.word_count === 'number'
    ? claudeLog.word_count > claudeLog.target_words
    : false
  claudeLog.status = 'COMPLETE'

  return {
    feedback,
    log: claudeLog,
    diagnostics: {
      model: 'claude-sonnet-4-5',
      status: 'COMPLETE',
      system_instructions: typeof nodeConfig.llm_system_instructions === 'string' ? nodeConfig.llm_system_instructions : null,
      prompt,
      response: feedback,
      input_tokens: inputTokens ?? null,
      output_tokens: outputTokens ?? null,
      skipped_reason: null,
    },
  }
}


const CLOUD_RUN_FETCH_TIMEOUT_MS = 300_000 // 5 minutes — Cloud Run /analyze can run up to ~600s

async function callCloudRun(payload: {
  uploadId: string
  video_url: string
  start_seconds: number
  end_seconds: number
  det_frequency: number
}): Promise<CloudRunResponse> {
  const rtmlibBase =
    Deno.env.get('MEDIAPIPE_SERVICE_URL')?.trim() ||
    Deno.env.get('RTMLIB_URL')?.trim() ||
    RTMLIB_FALLBACK
  const normalizedBase = rtmlibBase.replace(/\/+$/, '')
  const rtmlibUrl = normalizedBase.endsWith('/analyze')
    ? normalizedBase
    : `${normalizedBase}/analyze`

  // Phase 1c.2 Slice B1 (R-08 contract): MediaPipe payload trimmed to 4 keys.
  // `solution_class`, `performance_mode`, `tracking_enabled` were accepted-but-ignored
  // by the service (Pydantic optional, extra='ignore'). Removed from edge first per
  // R-08 mitigation ordering. Service-side schema cleanup tracked separately.
  const requestPayload = {
    video_url: payload.video_url,
    start_seconds: payload.start_seconds,
    end_seconds: payload.end_seconds,
    det_frequency: payload.det_frequency,
  }

  // Finding 5 (permanent observability for R-08): log the exact key set posted to
  // MediaPipe before every fetch. If the contract drifts, this is the canary.
  logInfo('mediapipe_request_payload', {
    uploadId: payload.uploadId,
    keys: Object.keys(requestPayload),
    keyCount: Object.keys(requestPayload).length,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CLOUD_RUN_FETCH_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(rtmlibUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    })
  } catch (err) {
    const isAbort = (err as Error).name === 'AbortError'
    throw new Error(
      isAbort
        ? `Cloud Run fetch timed out after ${CLOUD_RUN_FETCH_TIMEOUT_MS / 1000}s (RTMLIB_URL: ${rtmlibUrl})`
        : `Cloud Run fetch failed (RTMLIB_URL: ${rtmlibUrl}): ${(err as Error).message}`
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(
      `Cloud Run call failed: ${response.status} ${response.statusText} ` +
      `(RTMLIB_URL: ${rtmlibUrl})${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`
    )
  }

  if (!response.body) {
    throw new Error(`Cloud Run returned no response body (RTMLIB_URL: ${rtmlibUrl})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let final: CloudRunResponse | null = null
  let streamError: { status: number; detail: unknown } | null = null

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let msg: { type?: string; data?: unknown; status?: number; detail?: unknown }
    try {
      msg = JSON.parse(trimmed)
    } catch (parseErr) {
      logWarn('cloud_run_stream_parse_failed', {
        upload_id: payload.uploadId,
        line_preview: trimmed.slice(0, 200),
        error: (parseErr as Error).message,
      })
      return
    }
    if (msg.type === 'keepalive') return
    if (msg.type === 'result') {
      final = msg.data as CloudRunResponse
      return
    }
    if (msg.type === 'error') {
      streamError = { status: msg.status ?? 500, detail: msg.detail }
      return
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) handleLine(line)
    }
    if (buf.length > 0) handleLine(buf)
  } catch (err) {
    const isAbort = (err as Error).name === 'AbortError'
    throw new Error(
      isAbort
        ? `Cloud Run stream timed out after ${CLOUD_RUN_FETCH_TIMEOUT_MS / 1000}s (RTMLIB_URL: ${rtmlibUrl})`
        : `Cloud Run stream read failed (RTMLIB_URL: ${rtmlibUrl}): ${(err as Error).message}`
    )
  }

  if (streamError) {
    const err: { status: number; detail: unknown } = streamError
    throw new Error(
      `Cloud Run pipeline error ${err.status}: ${
        typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)
      } (RTMLIB_URL: ${rtmlibUrl})`
    )
  }

  if (!final) {
    throw new Error(`Cloud Run stream ended without result (RTMLIB_URL: ${rtmlibUrl})`)
  }

  const result = final as CloudRunResponse & { progress_updates?: CloudRunProgressUpdate[] }

  if (Array.isArray(result.progress_updates)) {
    const lastProgress = result.progress_updates[result.progress_updates.length - 1]
    if (lastProgress?.message) {
      await setUploadProgress(
        payload.uploadId,
        buildProgressMessage(lastProgress.message, {
          frame: lastProgress.frame,
          totalFrames: lastProgress.total_frames,
          detectionEveryN: lastProgress.detection_every_n,
        }),
      )
    }
  }

  return result
}

async function writeResults(
  upload: any,
  nodeConfig: any,
  scoreResult: any,
  metricResults: any[],
  errorResults: any,
  feedback: string,
  logData: PipelineLogData,
  cloudRunMetadata: CloudRunMetadata,
  calibrationAudit: CalibrationAudit,
  diagnostics: RunDiagnostics,
) {
  const { error } = await supabase
    .from('athlete_lab_results')
    .insert({
      upload_id: upload.id,
      athlete_id: upload.athlete_id,
      node_id: upload.node_id,
      node_version: nodeConfig.node_version,
      aggregate_score: scoreResult.aggregate_score,
      phase_scores: scoreResult.phase_scores,
      metric_results: metricResults,
      feedback,
      result_data: {
        ...(Object.keys(cloudRunMetadata).length > 0 ? cloudRunMetadata : {}),
        log_data: logData,
        calibration_audit: calibrationAudit,
        diagnostics,
      },
      confidence_flags: buildConfidenceFlags(metricResults, logData.rtmlib?.keypoint_confidence),
      detected_errors: errorResults.detected,
      analyzed_at: new Date().toISOString()
    })

  if (error) throw new Error(`Failed to write results: ${error.message}`)
}

function buildConfidenceFlags(metricResults: any[], keypointConfidence: unknown) {
  const flags: Array<Record<string, unknown>> = []
  for (const m of metricResults) {
    if (m.status === 'flagged') flags.push({ metric: m.name, reason: m.reason || 'low_confidence' })
    if (m.status === 'skipped' && m.reason === 'implausible_value') {
      flags.push({ metric: m.name, reason: 'implausible_value', raw_value: m.detail?.raw_value ?? null, plausible_range: m.detail?.plausible_range ?? null })
    }
  }
  const unreliable = new Map<number, number>()
  if (Array.isArray(keypointConfidence)) {
    for (const entry of keypointConfidence as Array<Record<string, unknown>>) {
      if (entry?.status === 'UNRELIABLE' && typeof entry.index === 'number') {
        unreliable.set(entry.index, typeof entry.mean_confidence === 'number' ? entry.mean_confidence : 0)
      }
    }
  }
  for (const m of metricResults) {
    if (m.status !== 'scored') continue
    const indices: number[] = m.detail?.bilateralDecision?.effectiveIndices ?? m.keypoint_mapping?.keypoint_indices ?? []
    const hits = indices.filter(i => unreliable.has(i))
    if (hits.length > 0) {
      flags.push({ metric: m.name, reason: 'keypoint_warning', keypoints: hits, note: 'Keypoint UNRELIABLE at clip level but passed window check; metric still scored.' })
    }
  }
  return flags
}

async function ensureNotCancelled(uploadId: string) {
  const { data, error } = await supabase
    .from('athlete_uploads')
    .select('status')
    .eq('id', uploadId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify upload status: ${error.message}`)
  }

  if (data?.status === 'cancelled') {
    await setUploadProgress(uploadId, 'Analysis cancelled.')
    throw createCancellationError(uploadId)
  }
}

async function updateUploadStatus(uploadId: string, status: string, error?: string, progressMessage?: string) {
  const updates: JsonRecord = { status }

  if (error !== undefined) updates.error_message = error
  if (progressMessage !== undefined) updates.progress_message = progressMessage

  const { error: dbError } = await supabase
    .from('athlete_uploads')
    .update(updates)
    .eq('id', uploadId)
  if (dbError) {
    console.error('updateUploadStatus DB error:', { uploadId, status, dbError: dbError.message })
  }
}

async function setUploadProgress(uploadId: string, message: string) {
  const { error: dbError } = await supabase
    .from('athlete_uploads')
    .update({ progress_message: message })
    .eq('id', uploadId)

  if (dbError) {
    console.error('setUploadProgress DB error:', { uploadId, message, dbError: dbError.message })
  }
}


function formatPhaseScores(phaseScores: Record<string, number>, phases: any[]): string {
  if (!phaseScores || !phases) return ''
  return phases
    .map(p => `${p.name}: ${Math.round(phaseScores[p.id] || 0)}/100`)
    .join(', ')
}

function formatMetricResults(metrics: any[]): string {
  return metrics
    .filter(m => m.status === 'scored')
    .map(m => `${m.name}: ${m.value}${m.unit} (target ${m.elite_target}${m.unit}, score ${m.score}/100)`)
    .join('\n')
}

const SKIP_REASON_TEXT: Record<string, string> = {
  no_catch: 'no catch recorded',
  low_confidence: 'body tracking was not clear enough',
  implausible_value: 'the measurement was outside a physically possible range',
  insufficient_valid_frames: 'not enough clearly tracked frames',
  no_calibration_available: 'distance calibration unavailable',
}

function formatSkippedMetrics(metrics: any[]): string {
  const notScored = metrics.filter(m => m.status !== 'scored')
  if (notScored.length === 0) return ''
  const lines = notScored.map(m => `- ${m.name}: ${SKIP_REASON_TEXT[m.reason] ?? (m.reason || 'not evaluated')}`)
  return `Not evaluated on this rep (do not quote numbers for these):\n${lines.join('\n')}`
}

function formatConfidenceFlags(metrics: any[]): string {
  const flagged = metrics.filter(m => m.status === 'flagged')
  if (flagged.length === 0) return ''
  return `Low confidence on: ${flagged.map(m => m.name).join(', ')}. ` +
    `Ensure full body visibility when filming.`
}
