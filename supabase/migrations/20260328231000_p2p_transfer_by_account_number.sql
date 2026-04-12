-- Peer-to-peer transfers: allow sending to any customer account by account number.
-- Clients cannot resolve other users' account UUIDs under RLS; SECURITY DEFINER RPC does the lookup.

CREATE OR REPLACE FUNCTION public.normalize_recipient_account_number(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_raw text;
BEGIN
  IF p_input IS NULL OR length(trim(p_input)) = 0 THEN
    RAISE EXCEPTION 'Account number is required';
  END IF;
  v_raw := upper(trim(regexp_replace(p_input, '\s+', '', 'g')));
  IF v_raw ~ '^ACC[0-9]{10}$' THEN
    RETURN v_raw;
  END IF;
  IF v_raw ~ '^[0-9]{12}$' THEN
    RETURN 'ACC' || right(v_raw, 10);
  END IF;
  RAISE EXCEPTION 'Use 12 digits or full number (ACC + 10 digits)';
END;
$$;

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
BEGIN
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination must differ';
  END IF;

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

CREATE OR REPLACE FUNCTION public.transfer_funds_by_account_number(
  p_from_account_id UUID,
  p_to_account_number TEXT,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Transfer',
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_to_id uuid;
BEGIN
  v_norm := public.normalize_recipient_account_number(p_to_account_number);
  SELECT id INTO v_to_id
  FROM public.accounts
  WHERE account_number = v_norm AND is_active = true;

  IF v_to_id IS NULL THEN
    RAISE EXCEPTION 'Recipient account not found';
  END IF;

  RETURN public.transfer_funds(
    p_from_account_id,
    v_to_id,
    p_amount,
    p_description,
    p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_recipient_account_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_funds_by_account_number(UUID, TEXT, NUMERIC, TEXT, UUID) TO authenticated;
