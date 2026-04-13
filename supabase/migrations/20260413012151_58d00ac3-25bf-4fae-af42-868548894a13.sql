
-- Create a trigger function that calls the edge function via pg_net
CREATE OR REPLACE FUNCTION public.trigger_analysis_on_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _service_role_key text;
  _payload jsonb;
BEGIN
  -- Build the edge function URL
  SELECT decrypted_secret INTO _url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL';

  SELECT decrypted_secret INTO _service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  _payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'athlete_uploads',
    'record', row_to_json(NEW)::jsonb
  );

  PERFORM net.http_post(
    url := _url || '/functions/v1/analyze-athlete-video',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    ),
    body := _payload
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to athlete_uploads on INSERT
CREATE TRIGGER on_athlete_upload_insert
AFTER INSERT ON public.athlete_uploads
FOR EACH ROW
EXECUTE FUNCTION public.trigger_analysis_on_upload();
