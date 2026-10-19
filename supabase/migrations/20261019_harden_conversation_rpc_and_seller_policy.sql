-- SOMLI IRAQ security hardening:
-- 1) prevent direct RPC execution of the trigger-only SECURITY DEFINER function;
--    the trigger can still invoke its function as part of INSERT processing.
REVOKE EXECUTE ON FUNCTION public.touch_conversation_after_message() FROM PUBLIC, anon, authenticated;

-- 2) ensure a conversation for a market listing references that listing's actual seller.
DROP POLICY IF EXISTS "Buyers start conversations with approved sellers" ON public.conversations;
CREATE POLICY "Buyers start conversations with approved sellers"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = (SELECT auth.uid())
    AND buyer_id <> seller_id
    AND closed_at IS NULL
    AND (
      (
        product_id IS NOT NULL
        AND listing_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.products p
          JOIN public.shops s ON s.id = p.shop_id
          WHERE p.id = conversations.product_id
            AND p.status = 'approved'
            AND s.status = 'approved'
            AND s.owner_id = conversations.seller_id
        )
      )
      OR
      (
        listing_id IS NOT NULL
        AND product_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.market_listings l
          WHERE l.id = conversations.listing_id
            AND l.status = 'approved'
            AND l.seller_id = conversations.seller_id
        )
      )
    )
  );
