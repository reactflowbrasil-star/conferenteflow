import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import {
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: recebimentos = [], isLoading } = useQuery({
    queryKey: ["recebimentos", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  // KPIs contam o universo total, não só os 8 últimos
  const { data: kpis } = useQuery({
    queryKey: ["recebimentos", "kpis"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [pend, conf, finHoje, divAgg] = await Promise.all([
        supabase
          .from("recebimentos")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
        supabase
          .from("recebimentos")
          .select("id", { count: "exact", head: true })
          .eq("status", "em_conferencia"),
        supabase
          .from("recebimentos")
          .select("id", { count: "exact", head: true })
          .in("status", ["finalizado", "com_divergencia"])
          .gte("finalizado_at", startOfDay.toISOString()),
        supabase
          .from("recebimentos")
          .select("total_divergencias")
          .gte("created_at", startOfDay.toISOString()),
      ]);
      const divergencias = (divAgg.data ?? []).reduce(
        (acc, r) => acc + (Number(r.total_divergencias) || 0),
        0,
      );
      return {
        pendentes: pend.count ?? 0,
        emConf: conf.count ?? 0,
        finalizados: finHoje.count ?? 0,
        divergencias,
      };
    },
  });

  const pendentes = kpis?.pendentes ?? 0;
  const emConf = kpis?.emConf ?? 0;
  const finalizados = kpis?.finalizados ?? 0;
  const divergencias = kpis?.divergencias ?? 0;

  return (
    <AppShell>
      <div className="grid-bg absolute inset-x-0 top-0 h-64 opacity-40" />

      <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        {/* Hero / greeting */}
        <section className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            Operação em tempo real
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-4xl">
            Bom turno, <span className="text-gradient-primary">conferente</span>.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            {recebimentos.length} notas no radar · {pendentes} aguardando conferência
          </p>
        </section>

        {/* KPIs */}
        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            icon={<PackageCheck className="h-4 w-4" />}
            label="Pendentes"
            value={pendentes}
            tone="muted"
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Em conferência"
            value={emConf}
            tone="accent"
          />
          <KpiCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Finalizados hoje"
            value={finalizados}
            tone="success"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Divergências"
            value={divergencias}
            tone="destructive"
          />
        </section>

        {/* Quick actions */}
        <section className="mb-8 grid gap-3 md:grid-cols-3">
          <Link
            to="/conferencia"
            className="group relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-primary p-5 shadow-elevated transition-transform hover:-translate-y-0.5"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground/70">
              Ação rápida
            </div>
            <div className="mt-2 text-xl font-bold text-primary-foreground">
              Iniciar bipagem
            </div>
            <div className="mt-1 text-xs text-primary-foreground/80">
              Abra a câmera e leia o código
            </div>
            <ArrowRight className="absolute right-5 top-5 h-5 w-5 text-primary-foreground transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/recebimentos"
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Recebimentos
            </div>
            <div className="mt-2 text-xl font-bold">Conferência cega</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Veja NF-es pendentes e em andamento
            </div>
          </Link>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              IA Visual
            </div>
            <div className="mt-2 text-xl font-bold">Detectar caixas</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Em breve · contagem por câmera
            </div>
          </div>
        </section>

        {/* Recent receipts */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Últimos recebimentos</h2>
            <Link to="/recebimentos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </div>

          <div className="space-y-2">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[78px] animate-pulse rounded-xl border border-border bg-card/50"
                />
              ))}
            {!isLoading && recebimentos.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
                Nenhum recebimento ainda.
              </div>
            )}
            {recebimentos.map((r) => (
              <Link
                key={r.id}
                to="/recebimentos/$id"
                params={{ id: r.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      NF #{r.numero_nf}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 truncate font-semibold">{r.fornecedor}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.loja} · {formatDateTime(r.created_at)}
                  </div>
                </div>
                <div className="ml-3 text-right">
                  <div className="font-mono text-lg font-bold tabular-nums">
                    {r.total_conferidos}
                    <span className="text-muted-foreground">/{r.total_itens}</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    itens
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "muted" | "accent" | "success" | "destructive";
}) {
  const toneMap = {
    muted: "text-muted-foreground",
    accent: "text-accent",
    success: "text-success",
    destructive: "text-destructive",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-gradient-surface p-4 shadow-elevated">
      <div className={`flex items-center gap-1.5 text-xs ${toneMap[tone]}`}>
        {icon}
        <span className="font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 font-mono text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
