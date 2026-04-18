create or replace function public.trigger_analysis_on_upload()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'net', 'extensions'
as $function$
declare
  _payload jsonb;
  _request_id bigint;
begin
  _payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'athlete_uploads',
    'record', row_to_json(NEW)::jsonb
  );

  select net.http_post(
    url := 'https://nwgljkjckcizbrpbqsro.supabase.co/functions/v1/analyze-athlete-video',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := _payload
  ) into _request_id;

  raise notice 'trigger_analysis_on_upload: queued request_id=% for upload_id=%', _request_id, NEW.id;
  return NEW;
exception
  when others then
    raise warning 'trigger_analysis_on_upload webhook failed: %', sqlerrm;
    return NEW;
end;
$function$;