-- ========== ENUM ==========
CREATE TYPE public.app_role AS ENUM ('conferente', 'supervisor', 'auditor');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles select own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "user_roles read own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "user_roles supervisor manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- ========== USER LOJAS ==========
CREATE TABLE public.user_lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loja text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, loja)
);
ALTER TABLE public.user_lojas ENABLE ROW LEVEL SECURITY;

-- Auditores têm acesso global (true sem precisar de registro)
CREATE OR REPLACE FUNCTION public.has_loja_access(_user_id uuid, _loja text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'auditor')
    OR EXISTS (
      SELECT 1 FROM public.user_lojas
      WHERE user_id = _user_id AND loja = _loja
    )
$$;

CREATE POLICY "user_lojas read own" ON public.user_lojas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "user_lojas supervisor manage" ON public.user_lojas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- ========== REPLACE OPEN POLICIES ON RECEBIMENTOS ==========
DROP POLICY IF EXISTS "public read recebimentos" ON public.recebimentos;
DROP POLICY IF EXISTS "public write recebimentos" ON public.recebimentos;

CREATE POLICY "recebimentos select"
  ON public.recebimentos FOR SELECT TO authenticated
  USING (public.has_loja_access(auth.uid(), loja));

CREATE POLICY "recebimentos insert"
  ON public.recebimentos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_loja_access(auth.uid(), loja)
    AND (public.has_role(auth.uid(), 'conferente') OR public.has_role(auth.uid(), 'supervisor'))
  );

CREATE POLICY "recebimentos update"
  ON public.recebimentos FOR UPDATE TO authenticated
  USING (
    public.has_loja_access(auth.uid(), loja)
    AND (public.has_role(auth.uid(), 'conferente') OR public.has_role(auth.uid(), 'supervisor'))
  )
  WITH CHECK (
    public.has_loja_access(auth.uid(), loja)
    AND (public.has_role(auth.uid(), 'conferente') OR public.has_role(auth.uid(), 'supervisor'))
  );

CREATE POLICY "recebimentos delete"
  ON public.recebimentos FOR DELETE TO authenticated
  USING (
    public.has_loja_access(auth.uid(), loja)
    AND public.has_role(auth.uid(), 'supervisor')
  );

-- ========== REPLACE OPEN POLICIES ON RECEBIMENTO_ITENS ==========
DROP POLICY IF EXISTS "public read itens" ON public.recebimento_itens;
DROP POLICY IF EXISTS "public write itens" ON public.recebimento_itens;

CREATE POLICY "itens select"
  ON public.recebimento_itens FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recebimentos r
    WHERE r.id = recebimento_id
      AND public.has_loja_access(auth.uid(), r.loja)
  ));

CREATE POLICY "itens insert"
  ON public.recebimento_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recebimentos r
    WHERE r.id = recebimento_id
      AND public.has_loja_access(auth.uid(), r.loja)
      AND (public.has_role(auth.uid(), 'conferente') OR public.has_role(auth.uid(), 'supervisor'))
  ));

CREATE POLICY "itens update"
  ON public.recebimento_itens FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recebimentos r
    WHERE r.id = recebimento_id
      AND public.has_loja_access(auth.uid(), r.loja)
      AND (public.has_role(auth.uid(), 'conferente') OR public.has_role(auth.uid(), 'supervisor'))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recebimentos r
    WHERE r.id = recebimento_id
      AND public.has_loja_access(auth.uid(), r.loja)
      AND (public.has_role(auth.uid(), 'conferente') OR public.has_role(auth.uid(), 'supervisor'))
  ));

CREATE POLICY "itens delete"
  ON public.recebimento_itens FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recebimentos r
    WHERE r.id = recebimento_id
      AND public.has_loja_access(auth.uid(), r.loja)
      AND public.has_role(auth.uid(), 'supervisor')
  ));