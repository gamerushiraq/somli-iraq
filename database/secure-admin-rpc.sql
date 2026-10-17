-- SOMLI Iraq: secure admin RPC functions.
-- Applied to live project vpducjdkjrbxeosdxvdi on 2026-10-17.
-- Safe to re-run: CREATE OR REPLACE and GRANT/REVOKE operations only.
-- The private schema must remain absent from Supabase's exposed API schemas.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$function$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function public.is_admin()
returns boolean language sql stable security invoker
set search_path = pg_catalog
as $function$
  select private.is_admin();
$function$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function private.admin_review_seller_application(p_application_id uuid, p_status text)
returns void language plpgsql security definer
set search_path = pg_catalog
as $function$
declare app public.seller_applications%rowtype;
begin
  if not private.is_admin() then raise exception 'admin_only'; end if;
  if p_status is null or p_status not in ('approved','rejected') then raise exception 'invalid_status'; end if;
  select * into app from public.seller_applications where id = p_application_id for update;
  if not found then raise exception 'application_not_found'; end if;
  update public.seller_applications set status = p_status where id = app.id;
  if p_status = 'approved' then
    update public.profiles set role = 'shop_owner' where id = app.user_id and role <> 'admin';
    if not exists (select 1 from public.shops where owner_id = app.user_id) then
      insert into public.shops(owner_id,name,governorate,phone,status)
      values (app.user_id,app.shop_name,app.governorate,app.contact,'approved');
    else
      update public.shops set status='approved', name=app.shop_name, governorate=app.governorate, phone=app.contact
      where owner_id = app.user_id;
    end if;
  end if;
end;
$function$;
revoke all on function private.admin_review_seller_application(uuid,text) from public, anon;
grant execute on function private.admin_review_seller_application(uuid,text) to authenticated, service_role;

create or replace function public.admin_review_seller_application(p_application_id uuid, p_status text)
returns void language sql security invoker
set search_path = pg_catalog
as $function$
  select private.admin_review_seller_application(p_application_id, p_status);
$function$;
revoke all on function public.admin_review_seller_application(uuid,text) from public, anon;
grant execute on function public.admin_review_seller_application(uuid,text) to authenticated, service_role;
