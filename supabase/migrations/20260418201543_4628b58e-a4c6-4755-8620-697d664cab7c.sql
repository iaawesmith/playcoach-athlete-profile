-- 1. Install pg_net extension
create extension if not exists pg_net with schema extensions;

-- 2. Refactor trigger to remove vault dependency
-- The analyze-athlete-video function has verify_jwt=false, so no auth header required.
-- The project URL is public (already in client code).
create or replace function public.trigger_analysis_on_upload()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  _payload jsonb;
begin
  _payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'athlete_uploads',
    'record', row_to_json(NEW)::jsonb
  );

  perform extensions.http_post(
    url := 'https://nwgljkjckcizbrpbqsro.supabase.co/functions/v1/analyze-athlete-video',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := _payload
  );

  return NEW;
exception
  when others then
    -- Never block the INSERT if the webhook call fails; surface in postgres logs only
    raise warning 'trigger_analysis_on_upload webhook failed: %', sqlerrm;
    return NEW;
end;
$function$;