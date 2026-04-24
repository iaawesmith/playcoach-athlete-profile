UPDATE public.athlete_lab_nodes SET status = 'live' WHERE id = '75ed4b18-8a22-440e-9a23-b86204956056';
UPDATE public.athlete_uploads SET status = 'pending', start_seconds = 0, end_seconds = 3, error_message = NULL, progress_message = NULL WHERE id = '66ea5e98-ff65-4d20-9e9e-232753d198aa';
DELETE FROM public.athlete_lab_results WHERE upload_id = '66ea5e98-ff65-4d20-9e9e-232753d198aa';