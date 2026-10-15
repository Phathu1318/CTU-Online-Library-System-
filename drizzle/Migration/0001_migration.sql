create policy "signed in read ebooks" on storage.objects for select to authenticated using (bucket_id = 'ebooks');
create policy "staff upload ebooks" on storage.objects for insert to authenticated with check (bucket_id = 'ebooks' and public.has_role(auth.uid(),'staff'));
create policy "staff update ebooks" on storage.objects for update to authenticated using (bucket_id = 'ebooks' and public.has_role(auth.uid(),'staff'));
create policy "staff delete ebooks" on storage.objects for delete to authenticated using (bucket_id = 'ebooks' and public.has_role(auth.uid(),'staff'));