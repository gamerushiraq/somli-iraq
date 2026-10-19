-- Ensure message edits stay within conversations the sender participates in.
-- Preserve the existing 15-minute edit window.
DROP POLICY IF EXISTS "Senders edit own recent messages" ON public.chat_messages;
CREATE POLICY "Senders edit own recent messages"
  ON public.chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = (SELECT auth.uid())
    AND created_at > now() - interval '15 minutes'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = chat_messages.conversation_id
        AND ((SELECT auth.uid()) = c.buyer_id OR (SELECT auth.uid()) = c.seller_id)
    )
  )
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND created_at > now() - interval '15 minutes'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = chat_messages.conversation_id
        AND ((SELECT auth.uid()) = c.buyer_id OR (SELECT auth.uid()) = c.seller_id)
    )
  );
