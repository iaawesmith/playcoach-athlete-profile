CREATE POLICY "Anyone can upload node icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'athlete-media' AND (storage.foldername(name))[1] = 'node-icons');