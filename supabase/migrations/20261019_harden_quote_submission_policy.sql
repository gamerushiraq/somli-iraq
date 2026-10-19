-- Only authenticated owners of approved shops may submit one quote per open request.
-- The existing UNIQUE(request_id, shop_id) constraint prevents duplicate quotes by a shop.
DROP POLICY IF EXISTS "Shops submit quotes" ON public.quotes;
CREATE POLICY "Approved shops submit quotes to open requests"
  ON public.quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shops s
      WHERE s.id = quotes.shop_id
        AND s.owner_id = (SELECT auth.uid())
        AND s.status = 'approved'
    )
    AND EXISTS (
      SELECT 1
      FROM public.quote_requests r
      WHERE r.id = quotes.request_id
        AND r.status = 'open'
    )
  );
