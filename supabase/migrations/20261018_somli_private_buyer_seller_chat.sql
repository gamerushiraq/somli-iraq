-- SOMLI IRAQ: private buyer/seller chat
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  listing_id uuid references public.market_listings(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint conversations_distinct_users check (buyer_id <> seller_id),
  constraint conversations_one_context check ((product_id is not null)::int + (listing_id is not null)::int = 1)
);
create unique index if not exists conversations_product_pair_unique on public.conversations (buyer_id, seller_id, product_id) where product_id is not null;
create unique index if not exists conversations_listing_pair_unique on public.conversations (buyer_id, seller_id, listing_id) where listing_id is not null;
create index if not exists conversations_buyer_recent_idx on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_seller_recent_idx on public.conversations (seller_id, last_message_at desc);
alter table public.conversations enable row level security;
drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations" on public.conversations for select to authenticated using (auth.uid() in (buyer_id, seller_id) or public.is_admin());
drop policy if exists "Buyers start conversations with approved sellers" on public.conversations;
create policy "Buyers start conversations with approved sellers" on public.conversations for insert to authenticated with check (
  buyer_id = auth.uid() and buyer_id <> seller_id and closed_at is null
  and ((product_id is not null and listing_id is null and exists (
    select 1 from public.products p join public.shops s on s.id = p.shop_id
    where p.id = product_id and p.status = 'approved' and s.status = 'approved' and s.owner_id = seller_id
  )) or (listing_id is not null and product_id is null and exists (
    select 1 from public.market_listings l where l.id = listing_id and l.status = 'approved' and l.seller_id = seller_id
  )))
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  image_path text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint chat_message_content_present check (length(trim(body)) > 0 or image_path is not null),
  constraint chat_message_body_limit check (char_length(body) <= 4000)
);
create index if not exists chat_messages_conversation_recent_idx on public.chat_messages (conversation_id, created_at desc);
alter table public.chat_messages enable row level security;
drop policy if exists "Participants read chat messages" on public.chat_messages;
create policy "Participants read chat messages" on public.chat_messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)) or public.is_admin()
);
drop policy if exists "Participants send chat messages" on public.chat_messages;
create policy "Participants send chat messages" on public.chat_messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id) and c.closed_at is null)
);
drop policy if exists "Senders edit own recent messages" on public.chat_messages;
create policy "Senders edit own recent messages" on public.chat_messages for update to authenticated using (sender_id = auth.uid() and created_at > now() - interval '15 minutes') with check (sender_id = auth.uid() and created_at > now() - interval '15 minutes');
drop policy if exists "Senders delete own messages" on public.chat_messages;
create policy "Senders delete own messages" on public.chat_messages for delete to authenticated using (sender_id = auth.uid() or public.is_admin());
create or replace function public.touch_conversation_after_message() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.conversations set last_message_at = new.created_at where id = new.conversation_id; return new; end; $$;
drop trigger if exists chat_message_touch_conversation on public.chat_messages;
create trigger chat_message_touch_conversation after insert on public.chat_messages for each row execute function public.touch_conversation_after_message();
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('somli-chat-images', 'somli-chat-images', false, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];
drop policy if exists "Chat participants upload own images" on storage.objects;
create policy "Chat participants upload own images" on storage.objects for insert to authenticated with check (
  bucket_id = 'somli-chat-images' and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.buyer_id, c.seller_id) and c.closed_at is null)
);
drop policy if exists "Chat participants read chat images" on storage.objects;
create policy "Chat participants read chat images" on storage.objects for select to authenticated using (
  bucket_id = 'somli-chat-images' and exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.buyer_id, c.seller_id))
);
drop policy if exists "Uploaders remove own chat images" on storage.objects;
create policy "Uploaders remove own chat images" on storage.objects for delete to authenticated using (
  bucket_id = 'somli-chat-images' and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.conversations c where c.id::text = (storage.foldername(name))[1] and auth.uid() in (c.buyer_id, c.seller_id))
);
do $$ begin
 if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then alter publication supabase_realtime add table public.chat_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then alter publication supabase_realtime add table public.conversations; end if;
 end if;
end $$;
