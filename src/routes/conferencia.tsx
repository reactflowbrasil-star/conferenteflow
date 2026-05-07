import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ScanLine, PackageCheck } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/conferencia")({
  component: ConferenciaIndex,
});

function ConferenciaIndex() {
  const { data = [] } = useQuery({
    queryKey: ["recebimentos", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select("*")
        .in("status", ["pendente", "em_conferencia"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
            <ScanLine className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Bipagem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione uma NF para iniciar a conferência cega
          </p>
        </div>

        <div className="space-y-2">
          {data.map((r) => (
            <Link
              key={r.id}
              to="/recebimentos/$id"
              params={{ id: r.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted">
                <PackageCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    NF #{r.numero_nf}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-0.5 truncate font-semibold">{r.fornecedor}</div>
              </div>
              <div className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                {r.total_conferidos}/{r.total_itens}
              </div>
            </Link>
          ))}
          {data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhuma NF em aberto. 🎉
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
