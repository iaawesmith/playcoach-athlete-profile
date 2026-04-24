UPDATE public.athlete_uploads
SET status = 'pending',
    start_seconds = 0,
    end_seconds = 3,
    error_message = NULL,
    progress_message = NULL
WHERE id = '66ea5e98-ff65-4d20-9e9e-232753d198aa';