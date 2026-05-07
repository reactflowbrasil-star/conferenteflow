
-- Recebimentos (NF-e headers)
CREATE TABLE public.recebimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_nf TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  cnpj TEXT,
  loja TEXT NOT NULL DEFAULT 'Loja 01',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, em_conferencia, finalizado, com_divergencia
  total_itens INTEGER NOT NULL DEFAULT 0,
  total_conferidos INTEGER NOT NULL DEFAULT 0,
  total_divergencias INTEGER NOT NULL DEFAULT 0,
  conferente TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_at TIMESTAMPTZ
);

CREATE TABLE public.recebimento_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id UUID NOT NULL REFERENCES public.recebimentos(id) ON DELETE CASCADE,
  ean TEXT NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'UN',
  qtd_esperada NUMERIC NOT NULL DEFAULT 0,
  qtd_conferida NUMERIC NOT NULL DEFAULT 0,
  preco_unitario NUMERIC,
  lote TEXT,
  validade DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, ok, divergencia, sobra, falta, avaria
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_itens_recebimento ON public.recebimento_itens(recebimento_id);
CREATE INDEX idx_itens_ean ON public.recebimento_itens(ean);

ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimento_itens ENABLE ROW LEVEL SECURITY;

-- MVP: acesso público (sem auth). Será restrito quando auth for adicionado.
CREATE POLICY "public read recebimentos" ON public.recebimentos FOR SELECT USING (true);
CREATE POLICY "public write recebimentos" ON public.recebimentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public read itens" ON public.recebimento_itens FOR SELECT USING (true);
CREATE POLICY "public write itens" ON public.recebimento_itens FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER set_updated_at_recebimentos BEFORE UPDATE ON public.recebimentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_updated_at_itens BEFORE UPDATE ON public.recebimento_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
