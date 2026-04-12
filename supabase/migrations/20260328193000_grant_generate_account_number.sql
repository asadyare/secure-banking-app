-- PostgREST (Supabase API) only exposes RPCs the caller role may EXECUTE.
-- Without this, supabase.rpc('generate_account_number') fails with a schema-cache / not-found error.

GRANT EXECUTE ON FUNCTION public.generate_account_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_account_number() TO service_role;
