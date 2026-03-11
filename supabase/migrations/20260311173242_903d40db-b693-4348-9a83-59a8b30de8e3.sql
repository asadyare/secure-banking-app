
-- Fix overly permissive audit logs insert policy
DROP POLICY "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert own audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
