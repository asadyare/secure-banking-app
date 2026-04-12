-- Demo: max balance allowed by NUMERIC(15,2) on accounts.balance
-- New users get "unlimited" starting balance; transfers no longer capped at 50k.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.accounts (user_id, account_number, account_type, account_name, balance)
  VALUES (
    NEW.id,
    public.generate_account_number(),
    'checking',
    'Primary Checking',
    9999999999999.99
  );

  RETURN NEW;
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
