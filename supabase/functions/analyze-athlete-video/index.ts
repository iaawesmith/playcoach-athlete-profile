import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RTMLIB_FALLBACK =
  'https://rtmlib-service-874407535869.us-central1.run.app'

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

    // Update status to processing immediately
    await updateUploadStatus(upload.id, 'processing', undefined, 'Downloading video from storage...')
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
    const detFrequency = selectDetFrequency(nodeConfig, context.people_in_video)
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

    // STEP 4: Prepare video and call Cloud Run rtmlib service
    await setUploadProgress(upload.id, 'Downloading video from storage...')
    const preparedVideo = await prepareVideoForCloudRun(upload as UploadLike)
    await ensureNotCancelled(upload.id)
    await setUploadProgress(upload.id, 'Loading RTMW model...')
    const rtmlibResult = await callCloudRun({
      uploadId: upload.id,
      video_url: preparedVideo.videoUrl,
      start_seconds: upload.start_seconds,
      end_seconds: upload.end_seconds,
      solution_class: nodeConfig.solution_class,
      performance_mode: nodeConfig.performance_mode,
      det_frequency: detFrequency,
      tracking_enabled: nodeConfig.tracking_enabled
    })
    const personCountSummary = summarizePersonCount(rtmlibResult.keypoints)
    logInfo('cloud_run_response_received', {
      uploadId,
      frameCount: rtmlibResult.frame_count,
      fps: rtmlibResult.fps,
      firstFramePersonCount: personCountSummary.firstFrame,
      maxFramePersonCount: personCountSummary.maxAcrossFrames,
    })
    await ensureNotCancelled(upload.id)

    // STEP 5: Apply temporal smoothing to keypoints
    await setUploadProgress(upload.id, 'Applying temporal smoothing to tracked keypoints...')
    const smoothedKeypoints = applyTemporalSmoothing(rtmlibResult.keypoints)
    const smoothedScores = rtmlibResult.scores

    // STEP 6: Lock onto target person
    await setUploadProgress(upload.id, 'Locking onto the athlete in frame...')
    const targetPersonIndex = lockTargetPerson(
      rtmlibResult.keypoints,
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
    const phaseWindows = buildPhaseWindows(
      rtmlibResult.frame_count,
      nodeConfig.phase_breakdown
    )

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

    // STEP 10: Error auto-detection
    await setUploadProgress(upload.id, 'Checking for common route errors...')
    const errorResults = detectErrors(nodeConfig.common_errors, metricResults)

    // STEP 11: Call Claude API
    await ensureNotCancelled(upload.id)
    await setUploadProgress(upload.id, 'Generating coaching feedback...')
    const feedback = await callClaude(nodeConfig, scoreResult, metricResults, errorResults, upload, context)
    logInfo('claude_feedback_received', {
      uploadId,
      feedbackLength: feedback.length,
    })

    // STEP 12: Write results
    await ensureNotCancelled(upload.id)
    await setUploadProgress(upload.id, 'Writing analysis results...')
    await writeResults(upload, nodeConfig, scoreResult, metricResults, errorResults, feedback)
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
      id, name, status, node_version,
      clip_duration_min, clip_duration_max,
      solution_class, performance_mode, det_frequency,
      det_frequency_solo, det_frequency_defender, det_frequency_multiple,
      tracking_enabled, segmentation_method,
      llm_prompt_template, llm_system_instructions,
      llm_tone, llm_max_words,
      scoring_rules, score_bands, scoring_renormalize_on_skip,
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
  const guidelines = nodeConfig.camera_guidelines || {}
  
  // Duration check
  const duration = upload.end_seconds - upload.start_seconds
  if (duration < nodeConfig.clip_duration_min || duration > nodeConfig.clip_duration_max) {
    return { passed: false, reason: `Duration ${duration}s outside bounds ${nodeConfig.clip_duration_min}-${nodeConfig.clip_duration_max}s` }
  }

  return { passed: true }
  // Note: Resolution and frame occupancy checks happen after Cloud Run
  // returns the video metadata. Frame size check requires actual frame analysis.
}


function selectDetFrequency(nodeConfig: any, peopleInVideo: string): number {
  switch (peopleInVideo) {
    case 'with_defender': return nodeConfig.det_frequency_defender || 1
    case 'multiple': return nodeConfig.det_frequency_multiple || 1
    case 'solo':
    default: return nodeConfig.det_frequency_solo || 2
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

function getCalibrationMetricDetail(calibration: ResolvedCalibration): JsonRecord {
  return {
    calibrationSource: calibration.source,
    calibrationConfidence: calibration.confidence,
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
  const dynamicPixelsPerYard = getPixelsPerYardValue(cloudRunCalibration)
  const dynamicConfidence = getCalibrationConfidenceLabel(cloudRunCalibration)

  if (dynamicPixelsPerYard !== null && dynamicConfidence === 'dynamic') {
    const resolved = {
      pixelsPerYard: dynamicPixelsPerYard,
      source: 'dynamic' as const,
      confidence: 1,
      reason: 'cloud_run_dynamic_calibration',
      details: {
        pixelsPerYard: dynamicPixelsPerYard,
        calibrationConfidence: dynamicConfidence,
      },
    }
    logInfo('calibration_resolved', resolved)
    return resolved
  }

  const dynamicFailureReason = dynamicPixelsPerYard === null
    ? 'dynamic_pixels_per_yard_unavailable'
    : `dynamic_confidence_${dynamicConfidence || 'missing'}`

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
          ...bodyBasedCalibration.details,
        },
      }
      logInfo('calibration_resolved', resolved)
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
        matchedCalibration: staticCalibration ?? {},
      },
    }
    logInfo('calibration_resolved', resolved)
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
      cameraAngle,
    },
  }
  logInfo('calibration_resolved', resolved)
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


function applyTemporalSmoothing(keypoints: VideoKeypoints, windowSize = 3): VideoKeypoints {
  // keypoints shape: [frame][person][keypoint_index] = [x, y]
  const numFrames = keypoints.length
  if (numFrames < windowSize) return keypoints

  const smoothed = JSON.parse(JSON.stringify(keypoints)) // deep copy

  for (let frame = 0; frame < numFrames; frame++) {
    for (let person = 0; person < keypoints[frame].length; person++) {
      for (let kp = 0; kp < keypoints[frame][person].length; kp++) {
        // Collect window frames
        const windowFrames = []
        for (let w = Math.max(0, frame - Math.floor(windowSize/2));
             w <= Math.min(numFrames - 1, frame + Math.floor(windowSize/2)); w++) {
          if (keypoints[w]?.[person]?.[kp]) {
            windowFrames.push(keypoints[w][person][kp])
          }
        }
        if (windowFrames.length > 0) {
          smoothed[frame][person][kp] = [
            windowFrames.reduce((s, p) => s + p[0], 0) / windowFrames.length,
            windowFrames.reduce((s, p) => s + p[1], 0) / windowFrames.length
          ]
        }
      }
    }
  }
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


function buildPhaseWindows(totalFrames: number, phaseBreakdown: any[]) {
  const windows: Record<string, { start: number, end: number }> = {}
  let framePosition = 0

  const sortedPhases = [...phaseBreakdown].sort((a, b) => 
    (a.sequence_order || 0) - (b.sequence_order || 0)
  )

  for (const phase of sortedPhases) {
    const phaseFrames = Math.round(totalFrames * (phase.proportion_weight / 100))
    const buffer = phase.frame_buffer || 3
    
    windows[phase.id] = {
      start: Math.max(0, framePosition - buffer),
      end: Math.min(totalFrames - 1, framePosition + phaseFrames + buffer)
    }
    framePosition += phaseFrames
  }

  logInfo('phase_windows_built', {
    totalFrames,
    phases: sortedPhases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      proportionWeight: phase.proportion_weight,
      frameBuffer: phase.frame_buffer || 3,
      start: windows[phase.id]?.start ?? null,
      end: windows[phase.id]?.end ?? null,
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

  for (const metric of metrics) {
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

    // Determine which side to use
    const side = resolveBilateral(mapping, context.route_direction)

    // Extract phase keypoints
    const phaseFrames = keypoints.slice(window.start, window.end + 1)
    const phaseScores = scores.slice(window.start, window.end + 1)
    logInfo('metric_window_selected', {
      ...metricContext,
      side,
      windowStart: window.start,
      windowEnd: window.end,
      frameCount: phaseFrames.length,
      keypointIndices: mapping.keypoint_indices,
      temporalWindow: mapping.temporal_window || null,
      confidenceThreshold: mapping.confidence_threshold || 0.7,
    })

    // Check confidence
    const confidenceCheck = checkConfidence(
      phaseFrames, phaseScores, personIndex,
      mapping.keypoint_indices, metric.name, mapping.confidence_threshold || 0.70
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
        metricValue = calculateAngle(phaseFrames, personIndex, mapping.keypoint_indices)
        break
      case 'distance':
        metricValue = calculateDistance(
          phaseFrames, personIndex, mapping.keypoint_indices,
          calibration,
          fallbackBehavior
        )
        break
      case 'velocity':
        metricValue = calculateVelocity(
          phaseFrames, personIndex, mapping.keypoint_indices,
          mapping.temporal_window || 3, fps, calibration, fallbackBehavior
        )
        break
      case 'acceleration':
        metricValue = calculateAcceleration(
          phaseFrames, personIndex, mapping.keypoint_indices,
          mapping.temporal_window || 5, fps, calibration, fallbackBehavior
        )
        break
      case 'frame_delta':
        metricValue = calculateFrameDelta(
          phaseFrames, personIndex, mapping.keypoint_indices,
          mapping.temporal_window || 10
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
        },
      })
      results.push({
        ...metric,
        status: 'skipped',
        reason: metricValue.reason || 'skipped',
        detail: {
          ...(metricValue.detail || {}),
          confidenceDiagnostics: confidenceCheck.diagnostics,
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

function resolveBilateral(mapping: any, routeDirection: string): string {
  if (mapping.bilateral_override && mapping.bilateral_override !== 'auto') {
    return mapping.bilateral_override
  }
  if (routeDirection === 'left') return 'force_left'
  if (routeDirection === 'right') return 'force_right'
  return 'auto'
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

  const confidenceHandling = nodeConfig.scoring_rules?.confidence_handling || 'skip'
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
  const minThreshold = nodeConfig.scoring_rules?.min_metrics_threshold || 50

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
) {
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
    athlete_level: context.athlete_level || 'high_school',
    focus_area: context.focus_area || '',
    skipped_metrics: scoreResult.skipped_metrics
      ? `Note: ${scoreResult.skipped_metrics} were not evaluated on this rep (no catch recorded).`
      : ''
  }

  // Inject variables into template
  let prompt = nodeConfig.llm_prompt_template
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value as string)
  }

  logInfo('claude_request_prepared', {
    uploadId: upload.id,
    nodeId: nodeConfig.id,
    nodeName: nodeConfig.name,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 500),
  })

  const requestPayload = {
    video_url: payload.video_url,
    start_seconds: payload.start_seconds,
    end_seconds: payload.end_seconds,
    solution_class: payload.solution_class,
    performance_mode: payload.performance_mode,
    det_frequency: payload.det_frequency,
    tracking_enabled: payload.tracking_enabled,
  }

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

  return feedback
}


async function prepareVideoForCloudRun(upload: UploadLike): Promise<{ videoUrl: string }> {
  const sourceUrl = typeof upload.video_url === 'string' ? upload.video_url.trim() : ''
  if (!sourceUrl) {
    throw new Error('Upload is missing a source video URL.')
  }

  await setUploadProgress(upload.id, 'Decimating video to 30 fps...')
  logInfo('video_decimation_started', { uploadId: upload.id, sourceUrlPresent: true, targetFps: 30 })

  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to download source video: ${response.status} ${response.statusText}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  const tempDir = await Deno.makeTempDir({ prefix: 'analysis-video-' })
  const inputPath = `${tempDir}/input.mp4`
  const outputPath = `${tempDir}/decimated-30fps.mp4`
  await Deno.writeFile(inputPath, bytes)

  try {
    const ffmpeg = new Deno.Command('ffmpeg', {
      args: ['-y', '-i', inputPath, '-r', '30', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-movflags', '+faststart', outputPath],
      stdout: 'piped',
      stderr: 'piped',
    })

    const result = await ffmpeg.output()
    if (result.code !== 0) {
      const stderr = new TextDecoder().decode(result.stderr).slice(0, 400)
      throw new Error(`FFmpeg failed while preparing video (${stderr || 'unknown error'})`)
    }

    const fileBytes = await Deno.readFile(outputPath)
    const targetPath = `test-clips/decimated/${upload.id}-30fps.mp4`

    const { error: uploadError } = await supabase.storage
      .from('athlete-videos')
      .upload(targetPath, fileBytes, {
        upsert: true,
        contentType: 'video/mp4',
      })

    if (uploadError) {
      throw new Error(`Failed to store 30 fps video: ${uploadError.message}`)
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from('athlete-videos')
      .createSignedUrl(targetPath, 60 * 60)

    if (signedError || !signedData?.signedUrl) {
      throw new Error(signedError?.message || 'Failed to sign 30 fps video URL.')
    }

    logInfo('video_decimation_complete', { uploadId: upload.id, targetFps: 30, targetPath })
    return { videoUrl: signedData.signedUrl }
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => undefined)
  }
}

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
  const rtmlibBase = Deno.env.get('RTMLIB_URL')?.trim() || RTMLIB_FALLBACK
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

  let response: Response
  try {
    response = await fetch(rtmlibUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    })
  } catch (err) {
    throw new Error(
      `Cloud Run fetch failed (RTMLIB_URL: ${rtmlibUrl}): ${(err as Error).message}`
    )
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(
      `Cloud Run call failed: ${response.status} ${response.statusText} ` +
      `(RTMLIB_URL: ${rtmlibUrl})${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`
    )
  }

  const result = await response.json() as CloudRunResponse & { progress_updates?: CloudRunProgressUpdate[] }

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
  feedback: string
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
