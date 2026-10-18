-- SOMLI IRAQ: rule-based moderation audit and tightly scoped approval RPC
create table if not exists public.moderation_reviews (
 id uuid primary key default gen_random_uuid(),
 entity_type text not null check (entity_type in ('market_listing','product','seller_application','quote_request')),
 entity_id uuid not null,
 decision text not null check (decision in ('auto_approved','needs_review')),
 risk_score integer not null default 0 check (risk_score between 0 and 100),
 reasons text[] not null default '{}',
 requested_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists moderation_reviews_entity_recent_idx on public.moderation_reviews(entity_type,entity_id,created_at desc);
alter table public.moderation_reviews enable row level security;
drop policy if exists "Admins read moderation audit" on public.moderation_reviews;
create policy "Admins read moderation audit" on public.moderation_reviews for select to authenticated using (public.is_admin());

create or replace function public.prevent_market_listing_approval_bypass()
returns trigger language plpgsql set search_path = ''
as $$
declare trusted_moderation boolean := current_user = 'postgres' and coalesce(current_setting('app.somli_moderation', true),'off') = 'on';
begin
  if not public.is_admin() and not trusted_moderation then
    if TG_OP = 'INSERT' and NEW.status <> 'pending' then
      raise exception 'Market listings must be submitted as pending for review' using errcode = '42501';
    end if;
    if TG_OP = 'UPDATE' and NEW.status = 'approved' and OLD.status is distinct from 'approved' then
      raise exception 'Only an administrator or trusted moderation function can approve a market listing' using errcode = '42501';
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.prevent_non_admin_approval_changes()
returns trigger language plpgsql security definer set search_path = 'public'
as $$
declare trusted_moderation boolean := current_user = 'postgres' and coalesce(current_setting('app.somli_moderation', true),'off') = 'on';
begin
  if not public.is_admin() and not trusted_moderation then
    if tg_table_name = 'shops' and new.status is distinct from old.status then
      raise exception 'Only an administrator can change shop approval status';
    end if;
    if tg_table_name = 'products' and new.status is distinct from old.status then
      raise exception 'Only an administrator or trusted moderation function can change product approval status';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.somli_moderation_apply(
 p_entity_type text, p_entity_id uuid, p_decision text, p_requested_by uuid,
 p_risk_score integer, p_reasons text[]
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare affected integer := 0;
begin
 if p_entity_type not in ('market_listing','product','seller_application','quote_request') then
  raise exception 'Unsupported moderation entity';
 end if;
 if p_decision not in ('auto_approved','needs_review') then
  raise exception 'Unsupported moderation decision';
 end if;
 if p_risk_score < 0 or p_risk_score > 100 then raise exception 'Invalid risk score'; end if;
 if p_decision = 'auto_approved' then
  if p_entity_type = 'market_listing' then
   perform set_config('app.somli_moderation','on',true);
   update public.market_listings set status='approved' where id=p_entity_id and status='pending';
   get diagnostics affected = row_count;
  elsif p_entity_type = 'product' then
   perform set_config('app.somli_moderation','on',true);
   update public.products set status='approved' where id=p_entity_id and status='pending';
   get diagnostics affected = row_count;
  else
   raise exception 'This entity type must remain under human review';
  end if;
  if affected <> 1 then raise exception 'Pending entity not found or status changed'; end if;
 end if;
 insert into public.moderation_reviews(entity_type,entity_id,decision,risk_score,reasons,requested_by)
 values (p_entity_type,p_entity_id,p_decision,least(100,greatest(0,p_risk_score)),coalesce(p_reasons,'{}'),p_requested_by);
 return jsonb_build_object('decision',p_decision,'risk_score',p_risk_score,'reasons',coalesce(p_reasons,'{}'));
end;
$$;
revoke all on function public.somli_moderation_apply(text,uuid,text,uuid,integer,text[]) from public, anon, authenticated;
grant execute on function public.somli_moderation_apply(text,uuid,text,uuid,integer,text[]) to service_role;
