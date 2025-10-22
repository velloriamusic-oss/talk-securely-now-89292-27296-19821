-- Allow users to mark received messages as delivered
CREATE POLICY "Users can mark received messages as delivered"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);