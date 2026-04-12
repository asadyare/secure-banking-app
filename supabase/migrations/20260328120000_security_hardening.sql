
-- Security hardening aligned with server-side ownership, least privilege, and idempotent writes.
-- See retail-banking-security patterns: IDOR prevention, idempotency keys, no direct ledger mutation.

-- ── Idempotency store (RPC-only writes; clients never insert directly) ──────
CREATE TABLE IF NOT EXISTS public.transfer_idempotency (
  idempotency_key UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transfer_idempotency_user_id_idx ON public.transfer_idempotency (user_id);

ALTER TABLE public.transfer_idempotency ENABLE ROW LEVEL SECURITY;

-- No policies: only SECURITY DEFINER functions (and superuser) access this table.

-- ── Tighten accounts: inserts cannot mint arbitrary balances from the client ─
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND balance = 0
  );

-- ── Remove direct transaction inserts from end users (ledger only via transfer_funds) ─
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;

-- ── Column-level UPDATE: balance/account_number immutable from authenticated role ─
REVOKE UPDATE ON public.accounts FROM authenticated;
GRANT UPDATE (account_name, account_type, is_active, currency) ON public.accounts TO authenticated;

REVOKE INSERT ON public.transactions FROM authenticated;

-- ── Replace transfer_funds: same-owner destination, optional idempotency, amount cap ─
DROP FUNCTION IF EXISTS public.transfer_funds(UUID, UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Internal Transfer',
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_balance NUMERIC;
  v_to_balance NUMERIC;
  v_ref_id TEXT;
  v_from_owner UUID;
  v_to_owner UUID;
  v_cached JSONB;
  v_result JSONB;
  v_max NUMERIC := 50000;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
    SELECT ti.result INTO v_cached
    FROM public.transfer_idempotency ti
    WHERE ti.idempotency_key = p_idempotency_key
      AND ti.user_id = auth.uid();
    IF v_cached IS NOT NULL
       AND (v_cached ? 'success')
       AND COALESCE((v_cached->>'success')::boolean, false) IS TRUE THEN
      RETURN v_cached;
    END IF;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_amount > v_max THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed for a single transfer';
  END IF;

  SELECT user_id, balance INTO v_from_owner, v_from_balance
  FROM public.accounts WHERE id = p_from_account_id FOR UPDATE;

  SELECT user_id, balance INTO v_to_owner, v_to_balance
  FROM public.accounts WHERE id = p_to_account_id FOR UPDATE;

  IF v_from_owner IS NULL OR v_to_owner IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_from_owner != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to transfer from this account';
  END IF;

  IF v_to_owner != auth.uid() THEN
    RAISE EXCEPTION 'Destination must be one of your accounts';
  END IF;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  v_ref_id := 'TXN-' || gen_random_uuid()::TEXT;

  UPDATE public.accounts SET balance = balance - p_amount WHERE id = p_from_account_id;
  UPDATE public.accounts SET balance = balance + p_amount WHERE id = p_to_account_id;

  INSERT INTO public.transactions (account_id, type, status, amount, balance_after, description, reference_id, counterparty_account_id)
  VALUES (p_from_account_id, 'debit', 'completed', p_amount, v_from_balance - p_amount, p_description, v_ref_id || '-D', p_to_account_id);

  INSERT INTO public.transactions (account_id, type, status, amount, balance_after, description, reference_id, counterparty_account_id)
  VALUES (p_to_account_id, 'credit', 'completed', p_amount, v_to_balance + p_amount, p_description, v_ref_id || '-C', p_from_account_id);

  v_result := jsonb_build_object('success', true, 'reference_id', v_ref_id);

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.transfer_idempotency (idempotency_key, user_id, result)
    VALUES (p_idempotency_key, auth.uid(), v_result)
    ON CONFLICT (idempotency_key) DO UPDATE
    SET result = EXCLUDED.result,
        user_id = EXCLUDED.user_id;
  END IF;

  RETURN v_result;
END;
$$;
