import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { Search, Filter, Plus, Loader2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { NotaScanner } from "@/components/NotaScanner";

export const Route = createFileRoute("/recebimentos/")({
  component: RecebimentosPage,
  head: () => ({
    meta: [{ title: "Recebimentos · Super Padrão" }],
  }),
});

type StatusFiltro = "todos" | "pendente" | "em_conferencia" | "finalizado" | "com_divergencia";

const FILTROS: { key: StatusFiltro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Pendentes" },
  { key: "em_conferencia", label: "Em conferência" },
  { key: "finalizado", label: "Finalizados" },
  { key: "com_divergencia", label: "Com divergência" },
];

function RecebimentosPage() {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [scanOpen, setScanOpen] = useState(false);
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const { data = [], isLoading } = useQuery({
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

  const filtered = useMemo(() => {
    const term = dq.trim().toLowerCase();
    return data.filter((r) => {
      if (filtro !== "todos" && r.status !== filtro) return false;
      if (!term) return true;
      return [r.numero_nf, r.fornecedor, r.loja]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, dq, filtro]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { todos: data.length };
    for (const r of data) acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, [data]);

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

        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por NF, fornecedor, loja…"
              className="h-11 w-full rounded-xl border border-border bg-input pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {FILTROS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                filtro === key
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 font-mono text-[10px] tabular-nums ${
                filtro === key ? "bg-primary-foreground/20" : "bg-muted/60"
              }`}>
                {counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {isLoading && (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
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

          {!isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
              {data.length === 0
                ? "Nenhum recebimento ainda. Clique em 'Nova NF' para começar."
                : "Nenhum recebimento corresponde aos filtros aplicados."}
            </div>
          )}
        </div>
      </div>
      <NotaScanner open={scanOpen} onClose={() => setScanOpen(false)} />
    </AppShell>
  );
}
