-- Supermercados, matriz/filiais e papeis por loja.

CREATE TABLE public.supermercados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supermercado_id uuid NOT NULL REFERENCES public.supermercados(id) ON DELETE CASCADE,
  matriz_id uuid REFERENCES public.lojas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  codigo text NOT NULL,
  cnpj text,
  tipo text NOT NULL DEFAULT 'filial' CHECK (tipo IN ('matriz', 'filial')),
  endereco text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supermercado_id, codigo)
);

CREATE TABLE public.user_loja_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, loja_id, role)
);

CREATE INDEX idx_lojas_supermercado ON public.lojas(supermercado_id);
CREATE INDEX idx_lojas_matriz ON public.lojas(matriz_id);
CREATE INDEX idx_user_loja_roles_user ON public.user_loja_roles(user_id);
CREATE INDEX idx_user_loja_roles_loja ON public.user_loja_roles(loja_id);

ALTER TABLE public.supermercados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_loja_roles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER supermercados_updated_at BEFORE UPDATE ON public.supermercados
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER lojas_updated_at BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Supervisores precisam enxergar usuarios pendentes para liberar acesso.
CREATE POLICY "profiles supervisor read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "profiles supervisor update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "supermercados read" ON public.supermercados
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'auditor')
    OR EXISTS (
      SELECT 1
      FROM public.user_loja_roles ulr
      JOIN public.lojas l ON l.id = ulr.loja_id
      WHERE ulr.user_id = auth.uid()
        AND l.supermercado_id = supermercados.id
    )
  );

CREATE POLICY "supermercados supervisor manage" ON public.supermercados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "lojas read" ON public.lojas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'auditor')
    OR EXISTS (
      SELECT 1
      FROM public.user_loja_roles ulr
      WHERE ulr.user_id = auth.uid()
        AND ulr.loja_id = lojas.id
    )
  );

CREATE POLICY "lojas supervisor manage" ON public.lojas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "user_loja_roles read own" ON public.user_loja_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "user_loja_roles supervisor manage" ON public.user_loja_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE OR REPLACE FUNCTION public.has_loja_access(_user_id uuid, _loja text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'auditor')
    OR EXISTS (
      SELECT 1 FROM public.user_lojas
      WHERE user_id = _user_id AND loja = _loja
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_loja_roles ulr
      JOIN public.lojas l ON l.id = ulr.loja_id
      WHERE ulr.user_id = _user_id
        AND (l.nome = _loja OR l.codigo = _loja)
    )
$$;

REVOKE EXECUTE ON FUNCTION public.has_loja_access(uuid, text) FROM anon, authenticated, public;
