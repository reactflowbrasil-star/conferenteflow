
-- supermercados
CREATE TABLE public.supermercados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supermercados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supermercados read all authenticated" ON public.supermercados
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "supermercados supervisor manage" ON public.supermercados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE TRIGGER supermercados_set_updated_at
  BEFORE UPDATE ON public.supermercados
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- lojas
CREATE TABLE public.lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supermercado_id uuid NOT NULL REFERENCES public.supermercados(id) ON DELETE CASCADE,
  matriz_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  cnpj text,
  tipo text NOT NULL DEFAULT 'matriz' CHECK (tipo IN ('matriz','filial')),
  endereco text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lojas read all authenticated" ON public.lojas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lojas supervisor manage" ON public.lojas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE TRIGGER lojas_set_updated_at
  BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- user_loja_roles
CREATE TABLE public.user_loja_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, loja_id, role)
);
ALTER TABLE public.user_loja_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_loja_roles read own" ON public.user_loja_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "user_loja_roles supervisor manage" ON public.user_loja_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
