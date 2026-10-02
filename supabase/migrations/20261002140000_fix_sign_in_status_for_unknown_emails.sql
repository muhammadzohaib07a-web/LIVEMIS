-- Fixes a bug in account_sign_in_status from 20261002120000.
--
-- An address with no account was answering 'unconfirmed' instead of 'none',
-- so the sign-in page told people to ask the MIS Head to confirm an account
-- that was never created.
--
-- The cause: the old body kept its own `found` flag and set it in the
-- SELECT ... INTO target list. When that SELECT matches no row, PL/pgSQL sets
-- every INTO target to NULL -- including the flag -- so `found` ended up NULL
-- rather than false. `IF NOT found` on a NULL is not true, so control fell
-- through to the next branch, where confirmed_at was (also) NULL and the
-- answer came back 'unconfirmed'.
--
-- The fix uses PL/pgSQL's own FOUND, which a SELECT INTO sets to a real
-- boolean and which a declared variable of the same name was shadowing.

CREATE OR REPLACE FUNCTION public.account_sign_in_status(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  confirmed_at timestamptz;
BEGIN
  SELECT u.email_confirmed_at
  INTO confirmed_at
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
    AND u.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'none';
  ELSIF confirmed_at IS NULL THEN
    RETURN 'unconfirmed';
  ELSE
    RETURN 'active';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.account_sign_in_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.account_sign_in_status(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Check it landed. made_up must now read 'none', not 'unconfirmed'.
-- ---------------------------------------------------------------------------
SELECT
  public.account_sign_in_status('nobody-at-all@leen-textile.invalid') AS made_up,
  public.account_sign_in_status('  NOBODY-at-all@leen-textile.invalid ') AS made_up_messy,
  public.account_sign_in_status((SELECT email FROM auth.users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1)) AS first_real_user;
