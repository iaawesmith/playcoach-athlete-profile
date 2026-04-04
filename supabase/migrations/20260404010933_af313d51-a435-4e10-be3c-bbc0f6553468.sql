
INSERT INTO storage.buckets (id, name, public)
VALUES ('athlete-media', 'athlete-media', true);

CREATE POLICY "Anyone can view athlete media"
ON storage.objects FOR SELECT
USING (bucket_id = 'athlete-media');

CREATE POLICY "Authenticated users can upload athlete media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'athlete-media');
