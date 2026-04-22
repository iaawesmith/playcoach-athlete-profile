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
  detail?: JsonRecord
}

type CalibrationLike = {
  camera_angle?: string | null
  pixels_per_yard?: number | null
}

type CalibrationResolution = {
  pixelsPerYard: number | null
  calibrationSource: 'cloud_run_calibration' | 'node_reference_fallback' | 'missing_calibration'
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

function logInfo(event: string, details: JsonRecord = {}) {
  console.info(JSON.stringify({ level: 'info', event, ...details }))
}

function logWarn(event: string, details: JsonRecord = {}) {
  console.warn(JSON.stringify({ level: 'warn', event, ...details }))
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
    await updateUploadStatus(upload.id, 'processing')

    // STEP 1: Fetch full node config
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
    const preflightResult = await runPreflight(upload, nodeConfig)
    if (!preflightResult.passed) {
      logWarn('preflight_failed', { uploadId, reason: preflightResult.reason })
      await updateUploadStatus(upload.id, 'failed', preflightResult.reason)
      return new Response(JSON.stringify({ error: preflightResult.reason }), { status: 400 })
    }
    logInfo('preflight_passed', { uploadId })

    // STEP 3: Select analysis context settings
    const context = upload.analysis_context || {}
    const detFrequency = selectDetFrequency(nodeConfig, context.people_in_video)
    const calibration = selectCalibration(nodeConfig, context.camera_angle || upload.camera_angle)
    logInfo('analysis_context_selected', {
      uploadId,
      peopleInVideo: context.people_in_video || 'unknown',
      routeDirection: context.route_direction || 'unknown',
      cameraAngle: context.camera_angle || upload.camera_angle || 'unknown',
      catchIncluded: context.catch_included !== false,
      detFrequency,
      hasCalibration: Boolean(calibration),
      pixelsPerYard: calibration?.pixels_per_yard ?? null,
    })

    // STEP 4: Call Cloud Run rtmlib service
    const rtmlibResult = await callCloudRun({
      video_url: upload.video_url,
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

    // STEP 5: Apply temporal smoothing to keypoints
    const smoothedKeypoints = applyTemporalSmoothing(rtmlibResult.keypoints)
    const smoothedScores = rtmlibResult.scores

    // STEP 6: Lock onto target person
    const targetPersonIndex = lockTargetPerson(
      rtmlibResult.keypoints,
      context.people_in_video
    )
    logInfo('target_person_locked', {
      uploadId,
      targetPersonIndex,
      peopleInVideo: context.people_in_video || 'unknown',
    })

    // STEP 7: Divide frames into phase windows
    const phaseWindows = buildPhaseWindows(
      rtmlibResult.frame_count,
      nodeConfig.phase_breakdown
    )

    // STEP 8: Calculate all metrics
    const metricResults = await calculateAllMetrics(
      nodeConfig.key_metrics,
      smoothedKeypoints,
      smoothedScores,
      phaseWindows,
      targetPersonIndex,
      calibration,
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

    // STEP 9: Calculate aggregate score
    const scoreResult = calculateAggregateScore(
      metricResults,
      nodeConfig,
      context.catch_included !== false
    )

    // STEP 10: Error auto-detection
    const errorResults = detectErrors(nodeConfig.common_errors, metricResults)

    // STEP 11: Call Claude API
    const feedback = await callClaude(nodeConfig, scoreResult, metricResults, errorResults, upload, context)
    logInfo('claude_feedback_received', {
      uploadId,
      feedbackLength: feedback.length,
    })

    // STEP 12: Write results
    await writeResults(upload, nodeConfig, scoreResult, metricResults, errorResults, feedback)
    logInfo('results_written', {
      uploadId,
      aggregateScore: scoreResult.aggregate_score,
      detectedErrors: errorResults.detected.length,
    })

    // STEP 13: Update status to complete
    await updateUploadStatus(upload.id, 'complete')
    logInfo('pipeline_completed', { uploadId, status: 'complete' })

    return new Response(JSON.stringify({ success: true }), { status: 200 })

  } catch (error) {
    const err = error as Error
    console.error('Pipeline error:', {
      uploadId,
      message: err.message,
      stack: err.stack,
    })

    if (uploadId) {
      try {
        await updateUploadStatus(uploadId, 'failed', err.message)
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

function resolvePixelsPerYard(runtimeCalibration: CalibrationLike | null, nodeCalibration: CalibrationLike | null): CalibrationResolution {
  const runtimePixelsPerYard = typeof runtimeCalibration?.pixels_per_yard === 'number' && runtimeCalibration.pixels_per_yard > 0
    ? runtimeCalibration.pixels_per_yard
    : null

  if (runtimePixelsPerYard !== null) {
    return {
      pixelsPerYard: runtimePixelsPerYard,
      calibrationSource: 'cloud_run_calibration',
    }
  }

  const fallbackPixelsPerYard = typeof nodeCalibration?.pixels_per_yard === 'number' && nodeCalibration.pixels_per_yard > 0
    ? nodeCalibration.pixels_per_yard
    : null

  if (fallbackPixelsPerYard !== null) {
    return {
      pixelsPerYard: fallbackPixelsPerYard,
      calibrationSource: 'node_reference_fallback',
    }
  }

  return {
    pixelsPerYard: null,
    calibrationSource: 'missing_calibration',
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
  calibration: any,
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

    const calibrationResolution = resolvePixelsPerYard(calibration, calibration)

    // Calculate based on type
    let metricValue: MetricValueResult = { value: null, reason: 'unsupported_calculation_type' }
    
    switch (mapping.calculation_type) {
      case 'angle':
        metricValue = calculateAngle(phaseFrames, personIndex, mapping.keypoint_indices)
        break
      case 'distance':
        metricValue = calculateDistance(
          phaseFrames, personIndex, mapping.keypoint_indices,
          calibrationResolution.pixelsPerYard
        )
        break
      case 'velocity':
        metricValue = calculateVelocity(
          phaseFrames, personIndex, mapping.keypoint_indices,
          mapping.temporal_window || 3, fps, calibrationResolution
        )
        break
      case 'acceleration':
        metricValue = calculateAcceleration(
          phaseFrames, personIndex, mapping.keypoint_indices,
          mapping.temporal_window || 5, fps, calibrationResolution
        )
        break
      case 'frame_delta':
        metricValue = calculateFrameDelta(
          phaseFrames, personIndex, mapping.keypoint_indices,
          mapping.temporal_window || 10
        )
        break
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
  indices: number[], pixelsPerYard: number
): MetricValueResult {
  const midFrame = Math.floor(frames.length / 2)
  const kps = frames[midFrame]?.[personIdx]
  if (!kps) return { value: null, reason: 'no_person_frames', detail: { midFrame, personIdx } }

  const [p1, p2] = indices.map(i => kps[i])
  if (!p1 || !p2) return { value: null, reason: 'missing_keypoints', detail: { midFrame, indices } }

  const pixelDist = Math.sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2)
  
  if (!pixelsPerYard || pixelsPerYard <= 0) {
    return {
      value: pixelDist,
      reason: 'missing_calibration',
      detail: { midFrame, indices, pixelsPerYard: pixelsPerYard ?? null },
    }
  }
  
  return {
    value: pixelDist / pixelsPerYard,
    detail: { midFrame, indices, pixelsPerYard },
  }
}

// VELOCITY: displacement per frame × fps → mph
function calculateVelocity(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], temporalWindow: number, fps: number
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
    velocities.push(pixelDisp * fps)
  }

  if (velocities.length === 0) {
    return {
      value: null,
      reason: 'no_velocity_samples',
      detail: { temporalWindow, indices, personIdx },
    }
  }
  return {
    value: velocities.reduce((s, v) => s + v, 0) / velocities.length,
    detail: { temporalWindow, indices, sampleCount: velocities.length, fps },
  }
  // Note: This returns pixels/second — divide by pixelsPerYard × 2.045 for mph
  // Edge Function should apply calibration conversion here
}

// ACCELERATION: velocity delta over temporal window
function calculateAcceleration(
  frames: VideoKeypoints, personIdx: number,
  indices: number[], temporalWindow: number, fps: number
) : MetricValueResult {
  if (frames.length < temporalWindow) {
    return {
      value: null,
      reason: 'insufficient_temporal_window',
      detail: { temporalWindow, availableFrames: frames.length },
    }
  }
  
  const v1 = calculateVelocity(frames.slice(0, Math.floor(temporalWindow/2)), personIdx, indices, 3, fps)
  const v2 = calculateVelocity(frames.slice(Math.floor(temporalWindow/2)), personIdx, indices, 3, fps)
  
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
    detail: { temporalWindow, timeSeconds, firstVelocity: v1.value, secondVelocity: v2.value },
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
  personIdx: number, indices: number[], threshold: number
): boolean {
  let totalChecks = 0
  let passedChecks = 0
  
  for (const frameScores of scores) {
    const personScores = frameScores[personIdx]
    if (!personScores) continue
    for (const idx of indices) {
      totalChecks++
      if ((personScores[idx] || 0) >= threshold) passedChecks++
    }
  }
  
  return totalChecks === 0 || (passedChecks / totalChecks) >= 0.4
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

async function callCloudRun(payload: {
  video_url: string
  start_seconds: number
  end_seconds: number
  solution_class: string
  performance_mode: string
  det_frequency: number
  tracking_enabled: boolean
}): Promise<{
  keypoints: VideoKeypoints
  scores: VideoScores
  frame_count: number
  fps: number
}> {
  const rtmlibBase = Deno.env.get('RTMLIB_URL')?.trim() || RTMLIB_FALLBACK
  const normalizedBase = rtmlibBase.replace(/\/+$/, '')
  const rtmlibUrl = normalizedBase.endsWith('/analyze')
    ? normalizedBase
    : `${normalizedBase}/analyze`

  let response: Response
  try {
    response = await fetch(rtmlibUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  return await response.json() as {
    keypoints: VideoKeypoints
    scores: VideoScores
    frame_count: number
    fps: number
  }
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

async function updateUploadStatus(uploadId: string, status: string, error?: string) {
  const { error: dbError } = await supabase
    .from('athlete_uploads')
    .update({ status, ...(error ? { error_message: error } : {}) })
    .eq('id', uploadId)
  if (dbError) {
    console.error('updateUploadStatus DB error:', { uploadId, status, dbError: dbError.message })
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
