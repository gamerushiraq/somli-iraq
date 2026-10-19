-- Restrict quote request updates to administrators.
-- Customers create and read their own requests in the current UI; there is no customer-side update workflow.
DROP POLICY IF EXISTS "Admins and customers update quote requests" ON public.quote_requests;
CREATE POLICY "Admins update quote requests"
  ON public.quote_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
