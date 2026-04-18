
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'athlete-videos',
  'athlete-videos',
  false,
  524288000,
  array['video/mp4', 'video/quicktime', 'video/webm']
);

create policy "Athletes can upload to their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'athlete-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Athletes can read their own videos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'athlete-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
