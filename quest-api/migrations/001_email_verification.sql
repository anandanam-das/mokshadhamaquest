-- Run manually against the production quest-api Postgres instance —
-- there's no migration runner wired up yet, this is applied by hand.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verify_token text,
  ADD COLUMN IF NOT EXISTS email_verify_expires timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_verify_token_idx
  ON users (email_verify_token)
  WHERE email_verify_token IS NOT NULL;
