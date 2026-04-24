UPDATE public.athlete_lab_nodes
SET key_metrics = (
  SELECT jsonb_agg(
    CASE
      WHEN metric->>'name' = 'Break Angle' THEN
        jsonb_set(metric, '{keypoint_mapping,keypoint_indices}', '[23, 25, 27]'::jsonb)
      WHEN metric->>'name' = 'Separation Distance' THEN
        jsonb_set(metric, '{keypoint_mapping,keypoint_indices}', '[23, 24]'::jsonb)
      WHEN metric->>'name' = 'Release Speed' THEN
        jsonb_set(metric, '{keypoint_mapping,keypoint_indices}', '[27, 28]'::jsonb)
      WHEN metric->>'name' = 'Head Snap Timing' THEN
        jsonb_set(metric, '{keypoint_mapping,keypoint_indices}', '[29, 0]'::jsonb)
      WHEN metric->>'name' = 'Hands Extension at Catch' THEN
        jsonb_set(metric, '{keypoint_mapping,keypoint_indices}', '[19, 20]'::jsonb)
      WHEN metric->>'name' = 'Post-Catch YAC Burst' THEN
        jsonb_set(metric, '{keypoint_mapping,keypoint_indices}', '[23, 24]'::jsonb)
      ELSE metric
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(key_metrics) WITH ORDINALITY AS t(metric, ordinality)
),
updated_at = now()
WHERE id = '75ed4b18-8a22-440e-9a23-b86204956056';