-- SOMLI: private staging images for seller applications.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'somli-pending-images',
  'somli-pending-images',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/avif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.seller_application_images (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.seller_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','image/avif')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists seller_application_images_application_idx
  on public.seller_application_images (application_id, created_at);

alter table public.seller_application_images enable row level security;

grant select, insert, delete on public.seller_application_images to authenticated;

drop policy if exists "Seller application images owner or admin read" on public.seller_application_images;
create policy "Seller application images owner or admin read"
on public.seller_application_images for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Owners add images to their pending application" on public.seller_application_images;
create policy "Owners add images to their pending application"
on public.seller_application_images for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.seller_applications a
    where a.id = application_id
      and a.user_id = (select auth.uid())
      and a.status = 'pending'
  )
);

drop policy if exists "Owners delete images from their pending application" on public.seller_application_images;
create policy "Owners delete images from their pending application"
on public.seller_application_images for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.seller_applications a
    where a.id = application_id
      and a.user_id = (select auth.uid())
      and a.status in ('pending','rejected')
  )
);

drop policy if exists "Pending application owners upload private staging images" on storage.objects;
create policy "Pending application owners upload private staging images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'somli-pending-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.seller_applications a
    where a.id::text = (storage.foldername(name))[2]
      and a.user_id = (select auth.uid())
      and a.status = 'pending'
  )
);

drop policy if exists "Pending application owners and admins read staging images" on storage.objects;
create policy "Pending application owners and admins read staging images"
on storage.objects for select to authenticated
using (
  bucket_id = 'somli-pending-images'
  and exists (
    select 1 from public.seller_applications a
    where a.id::text = (storage.foldername(name))[2]
      and (a.user_id = (select auth.uid()) or public.is_admin())
  )
);

drop policy if exists "Pending application owners delete staging images" on storage.objects;
create policy "Pending application owners delete staging images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'somli-pending-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.seller_applications a
    where a.id::text = (storage.foldername(name))[2]
      and a.user_id = (select auth.uid())
      and a.status in ('pending','rejected')
  )
);

-- Remove broad upload permission on the public product-image bucket.
drop policy if exists "Users upload images to their own Somli folder" on storage.objects;

-- Restrict mutation of public product images to owners of approved shops.
alter policy "Users update images in their own Somli folder"
on storage.objects
using (
  bucket_id = 'somli-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.status = 'approved')
)
with check (
  bucket_id = 'somli-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.status = 'approved')
);

alter policy "Users delete images in their own Somli folder"
on storage.objects
using (
  bucket_id = 'somli-product-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.status = 'approved')
);
