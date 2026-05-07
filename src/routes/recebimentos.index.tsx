import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { Search, Filter, Plus } from "lucide-react";
import { useState } from "react";
import { NotaScanner } from "@/components/NotaScanner";

export const Route = createFileRoute("/recebimentos/")({
  component: RecebimentosPage,
  head: () => ({
    meta: [{ title: "Recebimentos · Super Padrão" }],
  }),
});

function RecebimentosPage() {
  const [q, setQ] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["recebimentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = data.filter((r) =>
    [r.numero_nf, r.fornecedor, r.loja].join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Operação
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Recebimentos</h1>
          </div>
          <button
            onClick={() => setScanOpen(true)}
            className="flex h-11 items-center gap-2 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" />
            Nova NF
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por NF, fornecedor, loja…"
              className="h-11 w-full rounded-xl border border-border bg-input pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <button className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground">
            <Filter className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {filtered.map((r) => {
            const pct = r.total_itens > 0 ? Math.round((r.total_conferidos / r.total_itens) * 100) : 0;
            return (
              <Link
                key={r.id}
                to="/recebimentos/$id"
                params={{ id: r.id }}
                className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        NF #{r.numero_nf}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-1.5 truncate font-semibold">{r.fornecedor}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.loja} · {formatDateTime(r.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xl font-bold tabular-nums">
                      {r.total_conferidos}
                      <span className="text-muted-foreground">/{r.total_itens}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      itens
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
              Nenhum recebimento encontrado.
            </div>
          )}
        </div>
      </div>
      <NotaScanner open={scanOpen} onClose={() => setScanOpen(false)} />
    </AppShell>
  );
}
