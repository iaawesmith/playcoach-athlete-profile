ALTER TABLE public.athlete_lab_results
ADD COLUMN IF NOT EXISTS upload_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'athlete_lab_results_upload_id_fkey'
  ) THEN
    ALTER TABLE public.athlete_lab_results
    ADD CONSTRAINT athlete_lab_results_upload_id_fkey
    FOREIGN KEY (upload_id)
    REFERENCES public.athlete_uploads(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_athlete_lab_results_upload_id
ON public.athlete_lab_results(upload_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public admin test uploads can add athlete video test clips'
  ) THEN
    CREATE POLICY "Public admin test uploads can add athlete video test clips"
    ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (
      bucket_id = 'athlete-videos'
      AND (storage.foldername(name))[1] = 'test-clips'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public admin test uploads can view athlete video test clips metadata'
  ) THEN
    CREATE POLICY "Public admin test uploads can view athlete video test clips metadata"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'athlete-videos'
      AND (storage.foldername(name))[1] = 'test-clips'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public admin test uploads can replace athlete video test clips'
  ) THEN
    CREATE POLICY "Public admin test uploads can replace athlete video test clips"
    ON storage.objects
    FOR UPDATE
    TO public
    USING (
      bucket_id = 'athlete-videos'
      AND (storage.foldername(name))[1] = 'test-clips'
    )
    WITH CHECK (
      bucket_id = 'athlete-videos'
      AND (storage.foldername(name))[1] = 'test-clips'
    );
  END IF;
END $$;