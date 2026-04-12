-- 16-digit account numbers (card-style). Migrate existing rows; update generators and P2P normalization.

CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_number text;
  digit int;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    new_number := '';
    FOR i IN 1..16 LOOP
      digit := floor(random() * 10)::int;
      new_number := new_number || digit::text;
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.accounts WHERE account_number = new_number);
    attempts := attempts + 1;
    IF attempts > 200 THEN
      RAISE EXCEPTION 'Could not allocate unique account number';
    END IF;
  END LOOP;
  RETURN new_number;
END;
$$;

-- One-time: replace non–16-digit account numbers (legacy ACC… / shorter forms)
DO $$
DECLARE
  r record;
  new_num text;
  digit int;
  i int;
  safety int;
BEGIN
  FOR r IN SELECT id FROM public.accounts WHERE account_number IS NULL OR account_number !~ '^[0-9]{16}$'
  LOOP
    safety := 0;
    LOOP
      new_num := '';
      FOR i IN 1..16 LOOP
        digit := floor(random() * 10)::int;
        new_num := new_num || digit::text;
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.accounts WHERE account_number = new_num);
      safety := safety + 1;
      IF safety > 300 THEN
        RAISE EXCEPTION 'Could not migrate account % to unique 16-digit number', r.id;
      END IF;
    END LOOP;
    UPDATE public.accounts SET account_number = new_num WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_recipient_account_number(p_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_digits text;
BEGIN
  IF p_input IS NULL OR length(trim(p_input)) = 0 THEN
    RAISE EXCEPTION 'Account number is required';
  END IF;
  v_digits := regexp_replace(trim(p_input), '\D', '', 'g');
  IF length(v_digits) = 16 AND v_digits ~ '^[0-9]{16}$' THEN
    RETURN v_digits;
  END IF;
  RAISE EXCEPTION 'Enter the 16-digit account number (spaces are optional)';
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_recipient_account_number(text) FROM PUBLIC;
