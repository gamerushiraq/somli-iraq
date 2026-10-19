-- Add a restrictive policy so message deletion is limited to conversation participants
-- or an administrator, even when an existing permissive policy allows sender-owned rows.
CREATE POLICY "Restrict message deletes to conversation participants"
  ON public.chat_messages
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = chat_messages.conversation_id
        AND ((SELECT auth.uid()) = c.buyer_id OR (SELECT auth.uid()) = c.seller_id)
    )
    OR public.is_admin()
  );
