WITH slant AS (
  SELECT * FROM public.athlete_lab_nodes WHERE name ILIKE '%slant%' ORDER BY created_at LIMIT 1
),
p AS (
  SELECT gen_random_uuid() AS id, t.*
  FROM (VALUES
    ('Release', 'The first 1-3 steps off the line of scrimmage. This phase establishes the athlete''s initial burst and sets the horizontal path of the crossing route.', 'Explode off the line with a decisive first step and attack the defender''s leverage immediately. Sell vertical for a beat so the defender cannot read cross off the release. Full acceleration, low pad level, eyes forward — a soft release lets the defender jam you and destroys the timing of the crossing window.', 1, 15, 3),
    ('Shallow Stem', 'The controlled push to crossing depth before flattening across the field. Depth discipline in this phase determines whether the route stays under the linebackers and in the throwing window.', 'Push to your assigned depth and hold it. Do not climb — every extra yard of drift walks you into the linebacker''s zone and shrinks the throwing window. Keep sprint mechanics through the stem and keep your shoulders square so the defender cannot tell when you flatten.', 2, 25, 3),
    ('Cross', 'The flat horizontal run across the formation. Speed retention through this phase is what turns a crossing route into open grass.', 'Flatten out and carry your speed all the way across. Do not decelerate to look for the ball — run to the window and let the ball find you. Stay flat, stay under the coverage, and keep your eyes level so you can locate the ball late without losing a step.', 3, 25, 4),
    ('Catch Window', 'The ball arrival zone in the middle of the field. Hands must extend early and away from the frame with contact expected immediately after the catch.', 'Extend your hands away from your body and catch the ball with your eyes all the way in. Thumbs in on high balls, thumbs out on low balls. Expect contact the instant you secure it — brace your core and finish the catch before you think about yards.', 4, 25, 3),
    ('YAC (After Catch)', 'Post-catch acceleration across and up the field. Elite crossers accelerate out of the catch instead of settling.', 'The moment the ball is secure, get your eyes up and accelerate. Do not settle or drift — one decisive cut, then attack the open grass the crossing route just created. This is where a 6-yard completion becomes 20.', 5, 10, 3)
  ) AS t(name, description, coaching_cues, sequence_order, proportion_weight, frame_buffer)
),
phases AS (
  SELECT jsonb_agg(jsonb_build_object(
    'id', id::text,
    'name', name,
    'description', description,
    'coaching_cues', coaching_cues,
    'sequence_order', sequence_order,
    'proportion_weight', proportion_weight,
    'frame_buffer', frame_buffer
  ) ORDER BY sequence_order) AS j
  FROM p
),
m AS (
  SELECT t.*
  FROM (VALUES
    ('Speed Retention', 'mph', 6.5, 30, 2.0, 10, 'velocity', '[23,24]'::jsonb, 0.4, 'none', 'Cross', 'Measures how much speed you carry through the flat portion of the cross, tracked from hip center. Elite crossers do not slow down to find the ball — they run to the window at full speed and let the quarterback lead them into it.', ARRAY['body'], false),
    ('Release Speed', 'mph', 7.0, 25, 2.0, 10, 'velocity', '[23,24]'::jsonb, 0.4, 'none', 'Release', 'Measures hip-center velocity over the first steps off the line. A fast release forces the defender to commit early and buys the timing the crossing route needs.', ARRAY['body'], false),
    ('Hands Extension at Catch', 'yards', 0.4, 25, 0.15, 5, 'distance', '[19,20]'::jsonb, 0.35, 'none', 'Catch Window', 'Measures the distance between your hands at the catch point. Extending away from the frame turns you into a bigger target, cuts drop rate, and protects the ball through contact in the middle of the field.', ARRAY['hands'], true),
    ('Crossing Depth Consistency', 'yards', 0.5, 20, 0.03, 15, 'distance_variance', '[23,24]'::jsonb, 0.4, 'none', 'Shallow Stem', 'Measures how consistently you hold your crossing depth instead of drifting upfield. Low variance means the route stays under the coverage and in the throwing window the quarterback is expecting.', ARRAY['body'], false)
  ) AS t(name, unit, elite_target, weight, tolerance, temporal_window, calc, kps, conf, bilateral, phase_name, description, body_groups, requires_catch)
),
metrics AS (
  SELECT jsonb_agg(jsonb_build_object(
    'name', m.name,
    'unit', m.unit,
    'active', true,
    'weight', m.weight,
    'tolerance', m.tolerance,
    'description', m.description,
    'eliteTarget', m.elite_target,
    'requires_catch', m.requires_catch,
    'temporal_window', m.temporal_window,
    'depends_on_metric_id', NULL,
    'internal_documentation', '',
    'keypoint_mapping', jsonb_build_object(
      'body_groups', to_jsonb(m.body_groups),
      'keypoint_indices', m.kps,
      'calculation_type', m.calc,
      'bilateral', m.bilateral,
      'bilateral_override', m.bilateral,
      'confidence_threshold', m.conf,
      'phase_id', p.id::text
    )
  ) ORDER BY m.weight DESC, m.name) AS j
  FROM m JOIN p ON p.name = m.phase_name
),
errs AS (
  SELECT jsonb_agg(jsonb_build_object(
    'error', e.error, 'severity', e.severity, 'correction', e.correction,
    'auto_detectable', e.auto_detectable, 'auto_detection_condition', e.cond
  ) ORDER BY e.ord) AS j
  FROM (VALUES
    (1, 'Drifting upfield across the field', 'critical', 'The athlete climbs while crossing instead of holding depth, walking into linebacker coverage and closing the throwing window the quarterback is reading.', true, 'Crossing Depth Consistency > 0.5'),
    (2, 'Slowing down to find the ball', 'critical', 'The athlete decelerates across the field to locate the ball instead of carrying speed to the window. Speed lost here cannot be recovered after the catch.', true, 'Speed Retention < 6.5'),
    (3, 'Body catch', 'critical', 'The athlete catches the ball against their body instead of extending hands away from the frame, increasing drop rate and exposing the ball to contact in the middle of the field.', false, 'Hands Extension at Catch < 0.4'),
    (4, 'Crossing too shallow into traffic', 'common', 'The athlete flattens below the assigned depth, running into underneath defenders and traffic instead of the open window.', true, 'Crossing Depth Consistency > 0.5'),
    (5, 'Eyes down after the catch', 'common', 'The athlete drops their eyes after securing the catch instead of getting them up to read pursuit, giving away the yards the crossing route created.', false, 'Speed Retention < 6.5')
  ) AS e(ord, error, severity, correction, auto_detectable, cond)
),
bdg AS (
  SELECT jsonb_agg(jsonb_build_object(
    'id', gen_random_uuid()::text, 'icon', b.icon, 'name', b.name, 'rarity', b.rarity,
    'condition', b.condition, 'description', b.description, 'condition_type', b.ctype,
    'sequence_order', b.ord, 'condition_count', b.ccount, 'condition_custom', b.condition,
    'condition_operator', '>=', 'condition_metric_id', b.metric, 'condition_threshold', b.threshold
  ) ORDER BY b.ord) AS j
  FROM (VALUES
    (0, '⚡', 'Clean Crosser', 'rare', 'Crossing Depth Consistency score >= 90 on 3 consecutive attempts', 'You hold your crossing depth at an elite level.', 'metric', 3, 'Crossing Depth Consistency', 90),
    (1, '💪', 'Quick Hands', 'rare', 'Hands Extension at Catch score >= 90 on 3 attempts', 'Your hand extension at the catch point is elite.', 'metric', 3, 'Hands Extension at Catch', 90),
    (2, '💎', 'Route Technician', 'common', 'Overall Route Mastery Score >= 85', 'Your crossing route mechanics are precise and consistent.', 'score', 1, NULL, 80),
    (3, '🚀', 'YAC Machine', 'rare', 'Speed Retention score >= 90 on 3 attempts', 'You carry speed through the catch and attack open grass.', 'metric', 3, 'Speed Retention', 90),
    (4, '🏆', 'Cross Master', 'legendary', 'Overall Route Mastery Score >= 95', 'You have mastered the crossing route at an elite level.', 'streak', 5, NULL, 90)
  ) AS b(ord, icon, name, rarity, condition, description, ctype, ccount, metric, threshold)
)
INSERT INTO public.athlete_lab_nodes (
  name, icon_url, position, status, clip_duration_min, clip_duration_max, node_version,
  overview, scoring_rules, camera_guidelines, llm_prompt_template, llm_system_instructions,
  llm_max_words, phase_context_mode, segmentation_method, confidence_handling,
  min_metrics_threshold, score_bands, reference_calibrations, reference_fallback_behavior,
  det_frequency_solo, det_frequency_defender, det_frequency_multiple,
  scoring_renormalize_on_skip, coaching_cues_migration_status,
  phase_breakdown, key_metrics, common_errors, badges, form_checkpoints, elite_videos, knowledge_base
)
SELECT
  'Cross', NULL, s.position, 'draft', s.clip_duration_min, s.clip_duration_max, 1,
  'The crossing route stretches a defense horizontally and turns a completion into open grass. This analysis measures your release, how consistently you hold your crossing depth, and whether you carry speed through the catch.',
  s.scoring_rules,
  replace(s.camera_guidelines, 'FILM YOUR SLANT ROUTE', 'FILM YOUR CROSS ROUTE'),
  s.llm_prompt_template, s.llm_system_instructions, s.llm_max_words, s.phase_context_mode,
  s.segmentation_method, s.confidence_handling, s.min_metrics_threshold, s.score_bands,
  s.reference_calibrations, s.reference_fallback_behavior,
  s.det_frequency_solo, s.det_frequency_defender, s.det_frequency_multiple,
  s.scoring_renormalize_on_skip, 'confirmed',
  phases.j, metrics.j, errs.j, bdg.j, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb
FROM slant s, phases, metrics, errs, bdg;