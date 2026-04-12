-- Admin role: credit any customer account. Only profiles.is_admin = true may call the RPCs.
-- Regular users cannot set is_admin (column-level UPDATE).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS 'Bank operator; may credit customer accounts via admin_credit_account RPC.';

-- Stop API clients from self-promoting to admin (only SQL / service_role can change is_admin)
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, address, date_of_birth) ON public.profiles TO authenticated;

-- List customer accounts by email (admin only); reads auth.users inside SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.admin_list_customer_accounts(p_email text)
RETURNS TABLE (
  account_id uuid,
  account_name text,
  account_number text,
  balance numeric,
  customer_email text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.account_name,
    a.account_number,
    a.balance,
    u.email::text,
    p.full_name
  FROM public.accounts a
  JOIN auth.users u ON u.id = a.user_id
  JOIN public.profiles p ON p.user_id = a.user_id
  WHERE u.email ILIKE '%' || trim(p_email) || '%'
  ORDER BY u.email, a.created_at;
END;
$$;

-- Credit a customer account (admin only); records a credit transaction with metadata
CREATE OR REPLACE FUNCTION public.admin_credit_account(
  p_to_account_id uuid,
  p_amount numeric,
  p_description text DEFAULT 'Admin credit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal numeric;
  v_owner uuid;
  v_ref text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT a.balance, a.user_id INTO v_bal, v_owner
  FROM public.accounts a
  WHERE a.id = p_to_account_id
  FOR UPDATE;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  v_ref := 'ADM-' || gen_random_uuid()::text;

  UPDATE public.accounts
  SET balance = balance + p_amount
  WHERE id = p_to_account_id;

  INSERT INTO public.transactions (
    account_id,
    type,
    status,
    amount,
    balance_after,
    description,
    reference_id,
    counterparty_account_id,
    metadata
  ) VALUES (
    p_to_account_id,
    'credit',
    'completed',
    p_amount,
    v_bal + p_amount,
    COALESCE(NULLIF(trim(p_description), ''), 'Admin credit'),
    v_ref,
    NULL,
    jsonb_build_object(
      'source', 'admin_credit',
      'admin_user_id', auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'reference_id', v_ref,
    'new_balance', v_bal + p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_customer_accounts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_account(uuid, numeric, text) TO authenticated;
