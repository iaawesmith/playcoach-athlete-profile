CREATE OR REPLACE FUNCTION public.validate_calibration_clip()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.expected_calibration_source NOT IN ('dynamic','height_based','body_based','static','unknown') THEN
    RAISE EXCEPTION 'expected_calibration_source must be dynamic, height_based, body_based, static or unknown';
  END IF;
  IF NEW.camera_setup NOT IN ('tripod','handheld') THEN
    RAISE EXCEPTION 'camera_setup must be tripod or handheld';
  END IF;
  IF NEW.storage_path NOT LIKE 'calibration-library/%' THEN
    RAISE EXCEPTION 'storage_path must be under calibration-library/';
  END IF;
  RETURN NEW;
END;
$function$;