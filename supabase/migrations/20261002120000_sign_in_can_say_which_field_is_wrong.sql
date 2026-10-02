-- Let the sign-in page say WHICH half of the login is wrong.
--
-- Supabase answers every bad sign-in with the same "Invalid login
-- credentials", on purpose: it refuses to confirm whether an address has an
-- account, so an outsider cannot harvest staff emails by guessing.
--
-- LEEN's helpdesk is internal and the people using it already know each
-- other's addresses, so that protection buys little here and costs a lot of
-- support calls. This function trades it away deliberately: anyone who can
-- reach the site can now ask whether an email has an account. Everything
-- else stays shut — it never reveals a password, a name, or a user id, and
-- it cannot be used to sign in.
--
-- If that trade is ever unwanted, revoke it and the page falls back on its
-- own to the old joint message:
--   REVOKE EXECUTE ON FUNCTION public.account_sign_in_status(text) FROM anon;

CREATE OR REPLACE FUNCTION public.account_sign_in_status(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  confirmed_at timestamptz;
  found boolean := false;
BEGIN
  SELECT u.email_confirmed_at, true
  INTO confirmed_at, found
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
    AND u.deleted_at IS NULL
  LIMIT 1;

  IF NOT found THEN
    RETURN 'none';
  ELSIF confirmed_at IS NULL THEN
    RETURN 'unconfirmed';
  ELSE
    RETURN 'active';
  END IF;
END;
$$;

-- The page calls this while signed out, so anon needs it; signed-in callers
-- hitting a stale session need it too.
REVOKE ALL ON FUNCTION public.account_sign_in_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.account_sign_in_status(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Check it landed. 'none' for a made-up address, 'active' for a real one.
-- ---------------------------------------------------------------------------
SELECT
  public.account_sign_in_status('nobody-at-all@leen-textile.invalid') AS made_up,
  public.account_sign_in_status((SELECT email FROM auth.users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1)) AS first_real_user;
