-- SOMLI Iraq: consolidate overlapping RLS policies for clearer and cheaper evaluation.
-- Applied to live project vpducjdkjrbxeosdxvdi on 2026-10-17.
-- This changes policies only; it does not update or delete user data.
-- Requires public.is_admin() to be a SECURITY INVOKER wrapper and the private helper
-- schema to remain outside Supabase's exposed API schemas.

drop policy if exists "Admins manage payment instructions" on public.market_payment_settings;
create policy "Admins insert payment instructions" on public.market_payment_settings
 for insert to authenticated with check (public.is_admin());
create policy "Admins update payment instructions" on public.market_payment_settings
 for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete payment instructions" on public.market_payment_settings
 for delete to authenticated using (public.is_admin());

drop policy if exists "Admins read all products" on public.products;
drop policy if exists "Read approved products" on public.products;
create policy "Public read approved products" on public.products
 for select to anon using (status = 'approved');
create policy "Authenticated read products" on public.products
 for select to authenticated using (
   status = 'approved'
   or exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = (select auth.uid()))
   or public.is_admin()
 );

drop policy if exists "Admins review products" on public.products;
drop policy if exists "Shop owner updates own products" on public.products;
create policy "Admins and owners update products" on public.products
 for update to authenticated
 using (
   public.is_admin()
   or exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = (select auth.uid()))
 )
 with check (
   public.is_admin()
   or exists (select 1 from public.shops s where s.id = products.shop_id and s.owner_id = (select auth.uid()))
 );

drop policy if exists "Admins read all quote requests" on public.quote_requests;
drop policy if exists "Approved shops read open quote requests" on public.quote_requests;
drop policy if exists "Users read own requests" on public.quote_requests;
create policy "Authenticated participants read quote requests" on public.quote_requests
 for select to authenticated using (
   public.is_admin()
   or (status = 'open' and exists (
     select 1 from public.shops s
     where s.owner_id = (select auth.uid()) and s.status = 'approved'
   ))
   or customer_id = (select auth.uid())
   or exists (
     select 1 from public.products p
     join public.shops s on s.id = p.shop_id
     where p.id = quote_requests.product_id and s.owner_id = (select auth.uid())
   )
 );

drop policy if exists "Admins update quote requests" on public.quote_requests;
drop policy if exists "Customers close own requests" on public.quote_requests;
create policy "Admins and customers update quote requests" on public.quote_requests
 for update to authenticated
 using (public.is_admin() or customer_id = (select auth.uid()))
 with check (public.is_admin() or customer_id = (select auth.uid()));

drop policy if exists "Admins read seller applications" on public.seller_applications;
drop policy if exists "Users read own seller applications" on public.seller_applications;
create policy "Users and admins read seller applications" on public.seller_applications
 for select to authenticated using (public.is_admin() or user_id = (select auth.uid()));
