CREATE OR REPLACE FUNCTION public.pipeline_health_introspect()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'trigger_function_exists', EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'trigger_analysis_on_upload'
    ),
    'upload_trigger_exists', EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'athlete_uploads'
        AND t.tgname = 'on_athlete_upload_insert'
        AND NOT t.tgisinternal
        AND t.tgenabled <> 'D'
    ),
    'pg_net_installed', EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    )
  )
$$;

REVOKE ALL ON FUNCTION public.pipeline_health_introspect() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pipeline_health_introspect() TO service_role;