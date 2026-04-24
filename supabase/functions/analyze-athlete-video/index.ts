import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RTMLIB_FALLBACK =
  'https://rtmlib-service-874407535869.us-central1.run.app'

const MAX_CLIP_WINDOW_SECONDS = 3

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
  source: 'dynamic' | 'body_based' | 'static' | 'none'
  confidence: number
  reason: string
  details: JsonRecord
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
}

const MIRROR_INDEX_BY_INDEX = buildMirrorIndexMap()

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
    solution_class?: string
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
      solution_class: nodeConfig.solution_class,
      performance_mode: nodeConfig.performance_mode,
      det_frequency: detFrequency,
      tracking_enabled: nodeConfig.tracking_enabled
    })
    const cloudRunMetadata = buildCloudRunMetadata(rtmlibResult)
    logData.rtmlib = {
      solution_class: nodeConfig.solution_class,
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
    const resolvedCalibration = resolveCalibration(
      rtmlibResult,
      trackedPersonFrames.keypoints,
      trackedPersonFrames.scores,
      getAthleteHeightMeasurement(context),
      nodeConfig,
      context.camera_angle || upload.camera_angle || ''
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
    if (!poseQualityAudit.usableData) {
      logData.claude_api = {
        model: 'claude-sonnet-4-5',
        status: 'SKIPPED',
        skipped_reason: 'Pose confidence too low to generate reliable coaching feedback.',
        target_words: typeof nodeConfig.llm_max_words === 'number' ? nodeConfig.llm_max_words : undefined,
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
      logInfo('claude_feedback_received', {
        uploadId,
        feedbackLength: feedback.length,
      })
    }

    // STEP 12: Write results
    await ensureNotCancelled(upload.id)
    await setUploadProgress(upload.id, 'Writing analysis results...')
    await writeResults(upload, nodeConfig, scoreResult, metricResults, errorResults, feedback, logData, cloudRunMetadata)
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
      solution_class, performance_mode, det_frequency,
      det_frequency_solo, det_frequency_defender, det_frequency_multiple,
      tracking_enabled, segmentation_method,
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

  return Array.from(totals.entries())
    .slice(0, 17)
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
      temporal_window: typeof metric?.keypoint_mapping?.temporal_window === 'number'
        ? metric.keypoint_mapping.temporal_window
        : 0,
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

function buildErrorDetectionLog(errors: any[], metricResults: any[], errorResults: { detected: string[] }) {
  const metricMap = new Map<string, number>()
  metricResults.forEach((metric) => {
    if (metric?.status === 'scored' && typeof metric?.value === 'number' && Number.isFinite(metric.value)) {
      metricMap.set(metric.name, metric.value)
    }
  })

  return Array.isArray(errors)
    ? errors.map((error) => {
        const condition = typeof error?.auto_detection_condition === 'string' ? error.auto_detection_condition : ''
        const metricName = condition.match(/^(.+?)\s*(>|<|>=|<=|=|!=)\s*[\d.]+$/)?.[1]?.trim() ?? ''
        const metricValue = metricName && metricMap.has(metricName) ? formatNumber(metricMap.get(metricName), 2) : 'N/A'
        return {
          name: typeof error?.error === 'string' ? error.error : typeof error?.name === 'string' ? error.name : 'Rule',
          auto_detectable: Boolean(error?.auto_detectable && condition),
          condition,
          metric_value: metricValue,
          evaluation_expression: condition || 'Manual review',
          triggered: errorResults.detected.includes(error?.error) || errorResults.detected.includes(error?.name),
        }
      })
    : []
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
        nodeConfig?.det_frequency_solo ?? nested?.solo ?? nodeConfig?.det_frequency,
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
): ResolvedCalibration {
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

  if (dynamicAssessment.accepted && dynamicAssessment.pixelsPerYard !== null) {
    const resolved = {
      pixelsPerYard: dynamicAssessment.pixelsPerYard,
      source: 'dynamic' as const,
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
    logInfo('calibration_resolved', resolved)
    logCalibrationSource(resolved)
    return resolved
  }

  const dynamicFailureReason = dynamicAssessment.reason

  if (athleteHeight) {
    logInfo('calibration_source_fallback', {
      from: 'dynamic',
      to: 'body_based',
      reason: dynamicFailureReason,
    })

    const bodyBasedCalibration = calculateBodyBasedCalibration(keypoints, scores, athleteHeight)
    if (bodyBasedCalibration.pixelsPerYard !== null && bodyBasedCalibration.confidence >= 0.3) {
      const resolved = {
        pixelsPerYard: bodyBasedCalibration.pixelsPerYard,
        source: 'body_based' as const,
        confidence: bodyBasedCalibration.confidence,
        reason: 'body_based_calibration_accepted',
        details: {
          method: bodyBasedCalibration.method,
          pixelsPerYard: bodyBasedCalibration.pixelsPerYard,
          dynamicFailureReason,
          ...bodyBasedCalibration.details,
        },
      }
      logInfo('calibration_resolved', resolved)
      logCalibrationSource(resolved)
      return resolved
    }

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

  const staticCalibration = selectCalibration(nodeConfig, cameraAngle)
  const staticPixelsPerYard = getPixelsPerYardValue(staticCalibration)
  if (staticPixelsPerYard !== null) {
    const resolved = {
      pixelsPerYard: staticPixelsPerYard,
      source: 'static' as const,
      confidence: 0.45,
      reason: 'node_reference_calibration',
      details: {
        cameraAngle,
        pixelsPerYard: staticPixelsPerYard,
        dynamicFailureReason,
        matchedCalibration: staticCalibration ?? {},
      },
    }
    logInfo('calibration_resolved', resolved)
    logCalibrationSource(resolved)
    return resolved
  }

  logInfo('calibration_source_fallback', {
    from: athleteHeight ? 'static' : 'dynamic',
    to: 'none',
    reason: 'no_valid_static_calibration',
  })

  const resolved = {
    pixelsPerYard: null,
    source: 'none' as const,
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
  logInfo('calibration_resolved', resolved)
  logCalibrationSource(resolved)
  return resolved
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

    const leftShoulder = frameKeypoints[5]
    const rightShoulder = frameKeypoints[6]
    const leftHip = frameKeypoints[11]
    const rightHip = frameKeypoints[12]

    const leftShoulderScore = frameScores[5]
    const rightShoulderScore = frameScores[6]
    const leftHipScore = frameScores[11]
    const rightHipScore = frameScores[12]

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
      bilateralDecision.effectiveIndices, metric.name, mapping.confidence_threshold || 0.70
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

    // Calculate based on type
    let metricValue: MetricValueResult = { value: null, reason: 'unsupported_calculation_type' }
    
    switch (mapping.calculation_type) {
      case 'angle':
        metricValue = calculateAngle(phaseFrames, personIndex, bilateralDecision.effectiveIndices)
        break
      case 'distance':
        metricValue = calculateDistance(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          calibration,
          fallbackBehavior
        )
        break
      case 'velocity':
        metricValue = calculateVelocity(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          mapping.temporal_window || 3, fps, calibration, fallbackBehavior
        )
        break
      case 'acceleration':
        metricValue = calculateAcceleration(
          phaseFrames, personIndex, bilateralDecision.effectiveIndices,
          mapping.temporal_window || 5, fps, calibration, fallbackBehavior
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
          mapping.temporal_window || 10, calibration, fallbackBehavior, metric.name
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
function calculateAngle(frames: VideoKeypoints, personIdx: number, indices: number[]): MetricValueResult {
  const midFrame = Math.floor(frames.length / 2)
  const kps = frames[midFrame]?.[personIdx]
   if (!kps) return { value: null, reason: 'no_person_frames', detail: { midFrame, personIdx } }

  const [p1, vertex, p2] = indices.map(i => kps[i])
   if (!p1 || !vertex || !p2) {
    return { value: null, reason: 'missing_keypoints', detail: { midFrame, indices } }
   }

  const v1 = [p1[0] - vertex[0], p1[1] - vertex[1]]
  const v2 = [p2[0] - vertex[0], p2[1] - vertex[1]]
  
  const dot = v1[0]*v2[0] + v1[1]*v2[1]
  const mag1 = Math.sqrt(v1[0]**2 + v1[1]**2)
  const mag2 = Math.sqrt(v2[0]**2 + v2[1]**2)
  
  if (mag1 === 0 || mag2 === 0) {
    return { value: null, reason: 'zero_magnitude_angle', detail: { midFrame, indices } }
  }
  
  return {
    value: Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI),
    detail: { midFrame, indices },
  }
}

// DISTANCE: Euclidean pixel distance converted to yards
function calculateDistance(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], calibration: ResolvedCalibration, fallbackBehavior: ReferenceFallbackBehavior
): MetricValueResult {
  const midFrame = Math.floor(frames.length / 2)
  const kps = frames[midFrame]?.[personIdx]
  if (!kps) return { value: null, reason: 'no_person_frames', detail: { midFrame, personIdx } }

  const [p1, p2] = indices.map(i => kps[i])
  if (!p1 || !p2) return { value: null, reason: 'missing_keypoints', detail: { midFrame, indices } }

  const pixelDist = Math.sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2)
  const calibrationDetail = getCalibrationMetricDetail(calibration)
  
  if (!calibration.pixelsPerYard || calibration.pixelsPerYard <= 0) {
    if (fallbackBehavior === 'disable_distance') {
      return {
        value: null,
        status: 'skipped',
        reason: 'no_calibration_available',
        detail: { midFrame, indices, pixelDistance: pixelDist, ...calibrationDetail },
      }
    }

    return {
      value: pixelDist,
      reason: 'missing_calibration',
      detail: {
        midFrame,
        indices,
        pixelDistance: pixelDist,
        warning: 'uncalibrated_pixel_value',
        ...calibrationDetail,
      },
    }
  }
  
  return {
    value: pixelDist / calibration.pixelsPerYard,
    detail: { midFrame, indices, pixelsPerYard: calibration.pixelsPerYard, ...calibrationDetail },
  }
}

// VELOCITY: displacement per frame × fps → mph
function calculateVelocity(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], temporalWindow: number, fps: number, calibration: ResolvedCalibration, fallbackBehavior: ReferenceFallbackBehavior
): MetricValueResult {
  const window = frames.slice(0, Math.min(temporalWindow, frames.length))
  if (window.length < 2) {
    return {
      value: null,
      reason: 'insufficient_temporal_window',
      detail: { requestedWindow: temporalWindow, actualWindow: window.length },
    }
  }

  const velocities: number[] = []
  const rawPixelsPerSecond: number[] = []
  const calibrationDetail = getCalibrationMetricDetail(calibration)
  
  for (let f = 1; f < window.length; f++) {
    const prev = window[f-1]?.[personIdx]
    const curr = window[f]?.[personIdx]
    if (!prev || !curr) continue

    // Use midpoint of specified keypoints
    const prevPos = getMidpoint(prev, indices)
    const currPos = getMidpoint(curr, indices)
    if (!prevPos || !currPos) continue

    const pixelDisp = Math.sqrt(
      (currPos[0]-prevPos[0])**2 + (currPos[1]-prevPos[1])**2
    )
    // Convert pixels/frame to mph
    // pixels/frame × fps = pixels/second
    // pixels/second ÷ pixelsPerYard = yards/second
    // yards/second × 3600/1760 = mph (approx 2.045)
    const pixelsPerSecond = pixelDisp * fps
    rawPixelsPerSecond.push(pixelsPerSecond)
    const mph = pixelsPerSecondToMph(pixelsPerSecond, calibration.pixelsPerYard)
    if (mph !== null) {
      velocities.push(mph)
    }
  }

  if (rawPixelsPerSecond.length === 0) {
    return {
      value: null,
      reason: 'no_velocity_samples',
      detail: { temporalWindow, indices, personIdx },
    }
  }

  if (velocities.length === 0) {
    if (fallbackBehavior === 'disable_distance') {
      return {
        value: null,
        status: 'skipped',
        reason: 'no_calibration_available',
        detail: {
          temporalWindow,
          indices,
          personIdx,
          sampleCount: rawPixelsPerSecond.length,
          rawPixelsPerSecondAverage: rawPixelsPerSecond.reduce((s, v) => s + v, 0) / rawPixelsPerSecond.length,
          ...calibrationDetail,
        },
      }
    }

    return {
      value: rawPixelsPerSecond.reduce((s, v) => s + v, 0) / rawPixelsPerSecond.length,
      reason: 'missing_calibration',
      detail: {
        temporalWindow,
        indices,
        personIdx,
        sampleCount: rawPixelsPerSecond.length,
        rawPixelsPerSecondAverage: rawPixelsPerSecond.reduce((s, v) => s + v, 0) / rawPixelsPerSecond.length,
        warning: 'uncalibrated_pixel_value',
        ...calibrationDetail,
      },
    }
  }

  const rawPixelsPerSecondAverage = rawPixelsPerSecond.reduce((s, v) => s + v, 0) / rawPixelsPerSecond.length
  return {
    value: velocities.reduce((s, v) => s + v, 0) / velocities.length,
    detail: {
      temporalWindow,
      indices,
      sampleCount: velocities.length,
      fps,
      pixelsPerYard: calibration.pixelsPerYard,
      rawPixelsPerSecondAverage,
      ...calibrationDetail,
    },
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
function getMidpoint(kps: PersonKeypoints, indices: number[]): Point | null {
  const points = indices.map(i => kps[i]).filter(p => p && p[0] > 0)
  if (points.length === 0) return null
  return [
    points.reduce((s, p) => s + p[0], 0) / points.length,
    points.reduce((s, p) => s + p[1], 0) / points.length
  ]
}

function checkConfidence(
  frames: VideoKeypoints, scores: VideoScores,
  personIdx: number, indices: number[], metricName: string, threshold: number
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
    threshold: 0.4,
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
    passed: passRatio >= 0.4,
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
    const effectiveIndices = routeSide === 'left' ? leftIndices : rightIndices
    logBilateralDecision(metricName, 'route_direction', routeSide, leftIndices, rightIndices, effectiveIndices, null, null)
    return {
      side: routeSide,
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

  // Handle flagged metrics based on confidence_handling rule
  const effectiveScored = [...scored]
  for (const metric of flagged) {
    if (confidenceHandling === 'penalize') {
      effectiveScored.push({ ...metric, score: 0, status: 'scored' })
    }
    // 'skip' and 'flag': exclude from aggregate
  }

  if (effectiveScored.length === 0) return { aggregate_score: 0, phase_scores: {} }

  let totalWeight = effectiveScored.reduce((s, m) => s + m.weight, 0)
  let weightedSum = effectiveScored.reduce((s, m) => s + (m.score * m.weight), 0)

  // Check min metrics threshold
  const totalMetrics = metricResults.length
  const skippedCount = skipped.length + (confidenceHandling === 'skip' ? flagged.length : 0)
  const skippedPercent = (skippedCount / totalMetrics) * 100
  const minThreshold = nodeConfig.min_metrics_threshold ?? 50

  // Observability: surface the actual scoring config that was applied, so
  // admin tests can verify the node's configured values were honored
  // (catches the silent-fallback class of bug previously introduced by
  // reading from the wrong column).
  logInfo('scoring_config_applied', {
    nodeId: nodeConfig.id,
    nodeName: nodeConfig.name,
    confidence_handling: confidenceHandling,
    min_metrics_threshold: minThreshold,
    renormalize_on_skip: renormalize,
    total_metrics: totalMetrics,
    scored_count: scored.length,
    flagged_count: flagged.length,
    skipped_count: skipped.length,
    skipped_percent: Number(skippedPercent.toFixed(1)),
  })

  if (skippedPercent > minThreshold) {
    return {
      aggregate_score: null,
      rejected: true,
      reason: `Too many skipped metrics: ${skippedPercent.toFixed(0)}% > ${minThreshold}%`
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
    skipped_metrics: skipped.map(m => m.name).join(', ')
  }
}


function detectErrors(errors: any[], metricResults: any[]) {
  const metricMap: Record<string, number> = {}
  for (const m of metricResults) {
    if (m.status === 'scored') metricMap[m.name] = m.value
  }

  const detected: string[] = []
  const context: string[] = []

  for (const error of errors) {
    if (!error.auto_detectable || !error.auto_detection_condition) {
      context.push(error.name)
      continue
    }

    // Parse condition: "MetricName operator value"
    // e.g. "Break Angle > 52"
    const parts = error.auto_detection_condition.match(
      /^(.+?)\s*(>|<|>=|<=|=|!=)\s*([\d.]+)$/
    )
    if (!parts) {
      context.push(error.name)
      continue
    }

    const [, metricName, operator, thresholdStr] = parts
    const metricValue = metricMap[metricName.trim()]
    const threshold = parseFloat(thresholdStr)

    if (metricValue === undefined) {
      context.push(error.name)
      continue
    }

    let triggered = false
    switch (operator) {
      case '>':  triggered = metricValue > threshold; break
      case '<':  triggered = metricValue < threshold; break
      case '>=': triggered = metricValue >= threshold; break
      case '<=': triggered = metricValue <= threshold; break
      case '=':  triggered = metricValue === threshold; break
      case '!=': triggered = metricValue !== threshold; break
    }

    if (triggered) detected.push(error.name)
    else context.push(error.name)
  }

  return { detected, context }
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
      ? `Confirmed errors observed: ${errorResults.detected.join(', ')}`
      : '',
    athlete_name: context.athlete_name || 'Athlete',
    node_name: nodeConfig.name,
    // A4: position now wired from nodeConfig (was previously omitted, so any
    // {{position}} token in a prompt template silently rendered as the literal
    // placeholder string instead of the node's configured position).
    position: nodeConfig.position || '',
    athlete_level: context.athlete_level || 'high_school',
    focus_area: context.focus_area || '',
    skipped_metrics: scoreResult.skipped_metrics
      ? `Note: ${scoreResult.skipped_metrics} were not evaluated on this rep (no catch recorded).`
      : ''
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

  return { feedback, log: claudeLog }
}


const CLOUD_RUN_FETCH_TIMEOUT_MS = 300_000 // 5 minutes — Cloud Run /analyze can run up to ~600s

async function callCloudRun(payload: {
  uploadId: string
  video_url: string
  start_seconds: number
  end_seconds: number
  solution_class: string
  performance_mode: string
  det_frequency: number
  tracking_enabled: boolean
}): Promise<CloudRunResponse> {
  const rtmlibBase =
    Deno.env.get('MEDIAPIPE_SERVICE_URL')?.trim() ||
    Deno.env.get('RTMLIB_URL')?.trim() ||
    RTMLIB_FALLBACK
  const normalizedBase = rtmlibBase.replace(/\/+$/, '')
  const rtmlibUrl = normalizedBase.endsWith('/analyze')
    ? normalizedBase
    : `${normalizedBase}/analyze`

  const requestPayload = {
    video_url: payload.video_url,
    start_seconds: payload.start_seconds,
    end_seconds: payload.end_seconds,
    solution_class: payload.solution_class,
    performance_mode: payload.performance_mode,
    det_frequency: payload.det_frequency,
    tracking_enabled: payload.tracking_enabled,
  }

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
      },
      confidence_flags: metricResults
        .filter(m => m.status === 'flagged')
        .map(m => ({ metric: m.name, reason: m.reason })),
      detected_errors: errorResults.detected,
      analyzed_at: new Date().toISOString()
    })

  if (error) throw new Error(`Failed to write results: ${error.message}`)
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

function formatConfidenceFlags(metrics: any[]): string {
  const flagged = metrics.filter(m => m.status === 'flagged')
  if (flagged.length === 0) return ''
  return `Low confidence on: ${flagged.map(m => m.name).join(', ')}. ` +
    `Ensure full body visibility when filming.`
}
