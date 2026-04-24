update public.athlete_lab_nodes
set clip_duration_min = 3,
    clip_duration_max = 3,
    updated_at = now()
where id = '75ed4b18-8a22-440e-9a23-b86204956056';

update public.athlete_uploads
set status = 'pending',
    start_seconds = 0,
    end_seconds = 3,
    error_message = null,
    progress_message = null
where id = '66ea5e98-ff65-4d20-9e9e-232753d198aa';