-- Keep anonymous reads limited to approved market listings.
-- Authenticated sellers may read their own listings; admins may read all listings.
-- This avoids invoking public.is_admin() for anonymous requests.
DROP POLICY IF EXISTS "Admins and users read allowed market listings" ON public.market_listings;

CREATE POLICY "Public read approved market listings"
  ON public.market_listings
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Sellers and admins read own market listings"
  ON public.market_listings
  FOR SELECT
  TO authenticated
  USING (seller_id = (SELECT auth.uid()) OR public.is_admin());
