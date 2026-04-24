-- Group B: Slant node metric updates, auto-detection minimal fix, prompt template update
-- Target row: Slant (id 75ed4b18-8a22-440e-9a23-b86204956056)
--
-- Changes:
--   B1 Plant Leg Extension (renamed from Break Angle): elite 45→140, tol 5→15, descriptions
--   B2 Hip Stability (renamed from Separation Distance): calc distance→distance_variance,
--      elite 1→0.05, tol 0.2→0.03, units yards→yards (std dev), tw 2→15
--   B3 Release Speed: keypoints [27,28]→[23,24] (hip center), elite 10→7
--   B4 Hands Extension at Catch: descriptions only
--   B5 Head Snap Timing: descriptions only (stays inactive)
--   B6 Post-Catch YAC Burst: descriptions only (stays inactive)
--
--   Auto-detection: 2 condition strings updated, 3 disabled (auto_detectable=false)
--   Prompt template: COACHING BREAKDOWN section gets {{position}} + {{node_name}} preamble

UPDATE public.athlete_lab_nodes
SET
  key_metrics = '[
    {
      "name": "Plant Leg Extension",
      "active": true,
      "weight": 50,
      "unit": "degrees",
      "eliteTarget": 140,
      "tolerance": 15,
      "temporal_window": 3,
      "depends_on_metric_id": null,
      "description": "Measures how bent the plant leg is at the moment of the break, using the angle between hip, knee, and ankle. Elite receivers load the plant leg with moderate knee flexion (~140°) to drive efficiently out of the cut — not too stiff, not too squatty.",
      "internal_documentation": "Measures the hip-knee-ankle joint angle of the plant leg at the moment of the break. A fully extended leg is 180° (stiff, injury-prone, poor force transfer). Biomechanics literature on cutting maneuvers shows elite athletes load the plant leg with approximately 25-40° of knee flexion at peak plant contact, producing a joint angle of 140-155°. Below 125° indicates wasteful squat; above 160° indicates a stiff plant.\n\nNote: this metric is frequently confused with the football coaching concept of ''45° break angle.'' That refers to the receiver''s direction of travel relative to vertical, not joint geometry. This metric measures joint geometry, not path angle. Target=45° would be biomechanically impossible for this keypoint selection.\n\nUpgrade path: when world_landmarks is captured (Phase 3), this metric can use real 3D joint angles instead of 2D projection, eliminating camera-angle-dependent variance.",
      "keypoint_mapping": {
        "body_groups": ["body", "feet"],
        "keypoint_indices": [23, 25, 27],
        "calculation_type": "angle",
        "bilateral": "auto",
        "bilateral_override": "auto",
        "confidence_threshold": 0.4,
        "phase_id": "e63c5444-0799-4b6a-8f67-e706e59f5d85"
      }
    },
    {
      "name": "Hip Stability",
      "active": true,
      "weight": 15,
      "unit": "yards",
      "eliteTarget": 0.05,
      "tolerance": 0.03,
      "temporal_window": 15,
      "depends_on_metric_id": null,
      "description": "Measures how stable the athlete''s hips stay across the break window. Elite route-running keeps the torso composed through the cut — low variance means no rocking, leaning, or losing posture during the plant.",
      "internal_documentation": "Measures the variance of hip-to-hip distance across the break window. A stable torso during the plant produces low variance — the athlete''s hip line stays composed. High variance indicates rocking, torso lean, or inefficient weight transfer.\n\nIMPORTANT: This metric does NOT measure separation from a defender. The keypoints [23, 24] are the athlete''s own left and right hip — the distance between them is torso width, not receiver-defender distance. True defender separation requires multi-person pose detection (num_poses ≥ 2), which is planned for Phase 4. Until then, this metric measures torso composure, which is itself a meaningful component of route-running quality.\n\nElite target derivation: a composed athlete''s hip-to-hip distance should remain within ±0.05 yd (~1.8 inches) across the 15-30 frame break window. Variance larger than this indicates the athlete is bending, rocking, or losing posture through the cut.\n\nCalculation: distance_variance = standard deviation of inter-hip distance across temporal_window frames, expressed in yards (requires Reference tab calibration).",
      "keypoint_mapping": {
        "body_groups": ["body"],
        "keypoint_indices": [23, 24],
        "calculation_type": "distance_variance",
        "bilateral": "none",
        "bilateral_override": "none",
        "confidence_threshold": 0.4,
        "phase_id": "e63c5444-0799-4b6a-8f67-e706e59f5d85"
      }
    },
    {
      "name": "Release Speed",
      "active": true,
      "weight": 20,
      "unit": "mph",
      "eliteTarget": 7,
      "tolerance": 2,
      "temporal_window": 10,
      "depends_on_metric_id": null,
      "description": "Measures the velocity of the athlete''s body (tracked at the hip center) during the release phase off the line of scrimmage. Elite receivers accelerate their whole body quickly out of the release, not just cycle their feet.",
      "internal_documentation": "Measures the velocity of the athlete''s hip-center (midpoint of left and right hip) during the release phase. Hip-center velocity is the best single-point proxy for whole-body velocity during route running — it captures actual locomotion through space, unlike ankle/foot velocity which captures stride cadence.\n\nPrevious implementation used ankle velocity ([27, 28]). That measures how fast the feet cycle, which is related to stride rate, not body speed. An athlete can have fast feet while their body makes slow progress through space (hesitation, overstriding, poor lean). Hip-center velocity corrects this.\n\nElite target derivation: during the release phase of a slant (first ~0.5s off the line), elite high-school-to-college athletes cover 3-4 yards, implying 6-8 mph average hip-center velocity. Target=7mph with tolerance ±2mph covers the elite-to-varsity range. Pro receivers reach 9-11 mph peaks on explosive releases.\n\nUpgrade path: world_landmarks (Phase 3) will enable true 3D velocity measurement and eliminate calibration-dependent accuracy loss.",
      "keypoint_mapping": {
        "body_groups": ["body"],
        "keypoint_indices": [23, 24],
        "calculation_type": "velocity",
        "bilateral": "none",
        "bilateral_override": "none",
        "confidence_threshold": 0.4,
        "phase_id": "d07d6365-1e25-47ec-b788-fca3be452820"
      }
    },
    {
      "name": "Head Snap Timing",
      "active": false,
      "weight": 15,
      "unit": "frames",
      "eliteTarget": 3,
      "tolerance": 2,
      "temporal_window": 10,
      "depends_on_metric_id": null,
      "description": "Measures the timing offset between the plant foot contacting the ground and the head rotating toward the quarterback. Elite receivers snap their head to find the ball within a few frames of the plant, without telegraphing the break too early.",
      "internal_documentation": "Measures the temporal offset (in frames) between left heel contact (landmark 29) and head rotation toward the QB (landmark 0). Elite receivers snap their head to the QB within 3 frames (~100ms at 30fps) of the plant foot contacting the ground. Late head rotation indicates ball-tracking delay; early rotation indicates telegraphing the break to the defender.\n\nACTIVATION BLOCKED PENDING VALIDATION: Heel-plant detection requires high confidence on landmark 29 (left heel) across the plant window, and head rotation detection requires landmark 0 (nose) tracked through the rotation. Both landmarks are in MediaPipe''s canonical schema but heel detection in particular is sensitive to camera angle (sideline view occludes one heel) and footwear (dark cleats against grass reduce visibility).\n\nActivation plan: after first-test validation of the four currently-active metrics confirms pose confidence is high on lower-body landmarks, activate in a later phase with a dedicated validation run. Target at activation: 3 frames, tolerance 2 frames.",
      "keypoint_mapping": {
        "body_groups": ["body", "feet"],
        "keypoint_indices": [29, 0],
        "calculation_type": "frame_delta",
        "bilateral": "left",
        "bilateral_override": "force_left",
        "confidence_threshold": 0.4,
        "phase_id": "e63c5444-0799-4b6a-8f67-e706e59f5d85"
      }
    },
    {
      "name": "Hands Extension at Catch",
      "active": true,
      "weight": 15,
      "unit": "yards",
      "eliteTarget": 0.4,
      "tolerance": 0.15,
      "temporal_window": 5,
      "requires_catch": true,
      "depends_on_metric_id": null,
      "description": "Measures how far apart the athlete''s hands are at the moment of catch. Elite receivers extend their arms with hands spread wide to create a larger target for the quarterback and prevent body-trapping the ball.",
      "internal_documentation": "Measures the distance between the athlete''s left and right index-finger landmarks at the moment of catch. Elite receivers catch the ball with extended arms and spread hands, creating a larger ''hand target'' for the quarterback and reducing body-trapping (catching the ball against the chest).\n\nTECHNICAL LIMITATION: MediaPipe Pose''s body model provides approximations of hand landmarks at the base of the fingers, not true fingertips. Landmarks 19/20 sit at the base-of-index-finger position, so the measured distance is 85-92% of true fingertip distance. Elite target of 0.4yd accounts for this systematic underestimation.\n\nUpgrade path (Phase 5): HandLandmarker is a separate MediaPipe task that provides 21 landmarks per hand including true fingertips. When enabled, this metric will switch to fingertip indices and the elite target will be recalibrated upward (~0.45-0.5 yd). Until then, the body-model approximation is internally consistent and accurate enough to distinguish ''extended arms'' (scored ≥75) from ''caught with body'' (scored ≤40).",
      "keypoint_mapping": {
        "body_groups": ["hands"],
        "keypoint_indices": [19, 20],
        "calculation_type": "distance",
        "bilateral": "none",
        "bilateral_override": "none",
        "confidence_threshold": 0.35,
        "phase_id": "b0484d0c-bda3-4bc0-a221-0734ea641c43"
      }
    },
    {
      "name": "Post-Catch YAC Burst",
      "active": false,
      "weight": 10,
      "unit": "mph/s",
      "eliteTarget": 5,
      "tolerance": 2,
      "temporal_window": 10,
      "requires_catch": true,
      "depends_on_metric_id": null,
      "description": "Measures the acceleration of the athlete''s body immediately after making the catch. Elite receivers catch in stride and immediately accelerate downfield, rather than catching and decelerating.",
      "internal_documentation": "Measures the acceleration of the athlete''s hip center during the 10 frames immediately following catch. Elite receivers convert the catch into immediate downfield acceleration, ''catching in stride'' rather than catching and decelerating.\n\nACTIVATION BLOCKED: This metric (a) requires requires_catch=true to be meaningful, (b) measures post-catch behavior which is often outside the 3-second clip window cap, and (c) benefits substantially from multi-pose support to measure acceleration relative to a nearby defender (true YAC vs absolute acceleration).\n\nActivation plan: defer until (1) Phase 4 multi-pose ships, enabling true YAC measurement, and (2) Phase 3 world landmarks ship, enabling precise acceleration measurement. At activation: target 2.5 yd/s² acceleration with tolerance 1 yd/s².",
      "keypoint_mapping": {
        "body_groups": ["body"],
        "keypoint_indices": [23, 24],
        "calculation_type": "acceleration",
        "bilateral": "none",
        "bilateral_override": "none",
        "confidence_threshold": 0.4,
        "phase_id": "24042d43-0982-4ffe-afd3-ad15857f4fef"
      }
    }
  ]'::jsonb,

  common_errors = '[
    {
      "error": "Rounding the break",
      "severity": "critical",
      "correction": "The break angle is too wide, creating a curved path instead of a sharp cut. Defenders can anticipate a rounded break and close the throwing window before the ball arrives.",
      "auto_detectable": true,
      "auto_detection_condition": "Plant Leg Extension < 125"
    },
    {
      "error": "Tipping the route with eyes",
      "severity": "common",
      "correction": "The athlete turns their head toward the QB before the break point, telegraphing the route to the defender during the stem phase.",
      "auto_detectable": false,
      "auto_detection_condition": "Head Snap Timing < 1"
    },
    {
      "error": "Slowing down before the break",
      "severity": "common",
      "correction": "The athlete decelerates gradually through the stem instead of maintaining full speed and making a decisive single-step plant.",
      "auto_detectable": true,
      "auto_detection_condition": "Release Speed < 5"
    },
    {
      "error": "Body catch",
      "severity": "critical",
      "correction": "The athlete catches the ball against their body instead of extending hands away from the frame, increasing drop rate and making them a smaller target.",
      "auto_detectable": false,
      "auto_detection_condition": "Catch Efficiency < 70"
    },
    {
      "error": "Drifting after the catch",
      "severity": "common",
      "correction": "The athlete moves laterally after securing the catch instead of turning upfield immediately, losing yards and giving defenders better pursuit angles.",
      "auto_detectable": false,
      "auto_detection_condition": "Post-Catch YAC Burst < 3.0"
    }
  ]'::jsonb,

  llm_prompt_template = E'Hey {{athlete_name}}, here\'s your {{node_name}} breakdown.\n\nSCORE: {{mastery_score}}/100\n{{phase_scores}}\n\nWHAT THE DATA SHOWS:\n{{metric_results}}\n\n{{detected_errors}}\n\n{{confidence_flags}}\n\n{{skipped_metrics}}\n\nCOACHING BREAKDOWN: You are coaching a {{position}} on a {{node_name}}. Use position-appropriate terminology, standards, and framing when describing technique and corrections.\n\nLead with the single most important thing the data shows — good or bad. Name the specific metric, the measured value, and what it means on the field. Then identify the one mechanic that if fixed would have the biggest impact on the next rep. Be specific — name the phase, the body part, and the exact movement correction.\n\nEnd with one drill or one cue the athlete can execute on their very next rep.',

  updated_at = now()
WHERE id = '75ed4b18-8a22-440e-9a23-b86204956056';