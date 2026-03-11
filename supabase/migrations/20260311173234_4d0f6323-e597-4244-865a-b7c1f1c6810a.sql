
-- Create account type enum
CREATE TYPE public.account_type AS ENUM ('checking', 'savings', 'business');

-- Create transaction type enum  
CREATE TYPE public.transaction_type AS ENUM ('credit', 'debit', 'transfer');

-- Create transaction status enum
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed', 'reversed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  address TEXT,
  date_of_birth DATE,
  kyc_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  account_type account_type NOT NULL DEFAULT 'checking',
  account_name TEXT NOT NULL DEFAULT 'Primary Account',
  balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create transactions table (immutable ledger)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_id TEXT UNIQUE,
  counterparty_account_id UUID REFERENCES public.accounts(id),
  counterparty_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT 
  USING (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT 
  WITH CHECK (account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid()));

-- Audit logs policies
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Timestamp triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate account number
CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'ACC' || LPAD(FLOOR(RANDOM() * 10000000000)::TEXT, 10, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  -- Create default checking account
  INSERT INTO public.accounts (user_id, account_number, account_type, account_name, balance)
  VALUES (NEW.id, public.generate_account_number(), 'checking', 'Primary Checking', 1000.00);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function for internal transfer (atomic)
CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Internal Transfer'
)
RETURNS JSONB AS $$
DECLARE
  v_from_balance NUMERIC;
  v_to_balance NUMERIC;
  v_ref_id TEXT;
  v_from_owner UUID;
  v_to_owner UUID;
BEGIN
  SELECT user_id, balance INTO v_from_owner, v_from_balance FROM public.accounts WHERE id = p_from_account_id FOR UPDATE;
  SELECT user_id, balance INTO v_to_owner, v_to_balance FROM public.accounts WHERE id = p_to_account_id FOR UPDATE;
  
  IF v_from_owner IS NULL OR v_to_owner IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  
  IF v_from_owner != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to transfer from this account';
  END IF;
  
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  v_ref_id := 'TXN-' || gen_random_uuid()::TEXT;
  
  UPDATE public.accounts SET balance = balance - p_amount WHERE id = p_from_account_id;
  UPDATE public.accounts SET balance = balance + p_amount WHERE id = p_to_account_id;
  
  INSERT INTO public.transactions (account_id, type, status, amount, balance_after, description, reference_id, counterparty_account_id)
  VALUES (p_from_account_id, 'debit', 'completed', p_amount, v_from_balance - p_amount, p_description, v_ref_id || '-D', p_to_account_id);
  
  INSERT INTO public.transactions (account_id, type, status, amount, balance_after, description, reference_id, counterparty_account_id)
  VALUES (p_to_account_id, 'credit', 'completed', p_amount, v_to_balance + p_amount, p_description, v_ref_id || '-C', p_from_account_id);
  
  RETURN jsonb_build_object('success', true, 'reference_id', v_ref_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
