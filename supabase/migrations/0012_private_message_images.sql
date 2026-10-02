-- Private image attachments for member-to-member conversations.
alter table public.messages
  add column if not exists attachment_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-images',
  'message-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "active members can upload conversation images" on storage.objects;
create policy "active members can upload conversation images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-images'
    and public.is_active_student()
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id::text = (storage.foldername(name))[1]
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "active members can read conversation images" on storage.objects;
create policy "active members can read conversation images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-images'
    and public.is_active_student()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id::text = (storage.foldername(name))[1]
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "active members can remove their uploaded conversation images" on storage.objects;
drop policy if exists "active members can remove conversation images" on storage.objects;
create policy "active members can remove conversation images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-images'
    and public.is_active_student()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id::text = (storage.foldername(name))[1]
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "active members can send messages in their conversations" on public.messages;
create policy "active members can send messages in their conversations"
  on public.messages for insert to authenticated
  with check (
    public.is_active_student()
    and sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id = auth.uid()
    )
    and (
      attachment_path is null
      or attachment_path like conversation_id::text || '/' || auth.uid()::text || '/%'
    )
  );
