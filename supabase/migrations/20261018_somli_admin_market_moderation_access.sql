drop policy if exists "Anyone can view available market listings" on public.market_listings;
create policy "Admins and users read allowed market listings" on public.market_listings
for select to public using (status = 'approved' or seller_id = (select auth.uid()) or public.is_admin());
drop policy if exists "Sellers can update their own market listings" on public.market_listings;
create policy "Sellers and admins update market listings" on public.market_listings
for update to authenticated using (seller_id = (select auth.uid()) or public.is_admin())
with check (seller_id = (select auth.uid()) or public.is_admin());