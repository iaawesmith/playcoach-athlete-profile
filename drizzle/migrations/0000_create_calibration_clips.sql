CREATE TABLE public.calibration_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  node_id uuid REFERENCES public.athlete_lab_nodes(id) ON DELETE SET NULL,
  duration_seconds double precision,
  resolution text,
  fps double precision,
  file_size_bytes bigint,
  created_by text,
  camera_angle text NOT NULL DEFAULT 'sideline',
  people_in_video text NOT NULL DEFAULT 'solo',
  route_direction text NOT NULL DEFAULT 'left',
  catch_status text NOT NULL DEFAULT 'yes',
  athlete_level text NOT NULL DEFAULT 'high_school',
  athlete_height double precision,
  athlete_height_unit text NOT NULL DEFAULT 'inches',
  athlete_wingspan double precision,
  athlete_wingspan_unit text NOT NULL DEFAULT 'inches',
  yard_lines_visible boolean NOT NULL DEFAULT false,
  yard_line_notes text NOT NULL DEFAULT '',
  start_yard_line double precision,
  break_yard_line double precision,
  expected_route_depth_yards double precision GENERATED ALWAYS AS (abs(break_yard_line - start_yard_line)) STORED,
  expected_calibration_source text NOT NULL DEFAULT 'unknown',
  hand_timed_splits text NOT NULL DEFAULT '',
  camera_setup text NOT NULL DEFAULT 'tripod',
  camera_distance_notes text NOT NULL DEFAULT '',
  depth_metric_key text,
  notes text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.calibration_clips TO service_role;
ALTER TABLE public.calibration_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calibration_clips_service_role" ON public.calibration_clips FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.validate_calibration_clip()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.expected_calibration_source NOT IN ('dynamic','body_based','static','unknown') THEN
    RAISE EXCEPTION 'expected_calibration_source must be dynamic, body_based, static or unknown';
  END IF;
  IF NEW.camera_setup NOT IN ('tripod','handheld') THEN
    RAISE EXCEPTION 'camera_setup must be tripod or handheld';
  END IF;
  IF NEW.storage_path NOT LIKE 'calibration-library/%' THEN
    RAISE EXCEPTION 'storage_path must be under calibration-library/';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_calibration_clip BEFORE INSERT OR UPDATE ON public.calibration_clips
FOR EACH ROW EXECUTE FUNCTION public.validate_calibration_clip();

CREATE TRIGGER update_calibration_clips_updated_at BEFORE UPDATE ON public.calibration_clips
FOR EACH ROW EXECUTE FUNCTION public.update_athlete_lab_nodes_updated_at();