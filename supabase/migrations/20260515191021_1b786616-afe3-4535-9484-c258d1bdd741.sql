-- WebAuthn credentials per user
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX idx_webauthn_credentials_user ON public.webauthn_credentials(user_id);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own credentials" ON public.webauthn_credentials
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users delete own credentials" ON public.webauthn_credentials
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Temporary challenges (managed by server with service role)
CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  challenge text NOT NULL,
  type text NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webauthn_challenges_lookup ON public.webauthn_challenges(user_id, type, expires_at);
CREATE INDEX idx_webauthn_challenges_email ON public.webauthn_challenges(email, type, expires_at);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (server) can access