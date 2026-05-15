import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { ArrowLeft, ScanLine, Check, AlertTriangle, Camera, Mic, CheckCircle2, QrCode, Search, History, Filter, Zap, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { lazy, Suspense } from "react";
import { QtyControls } from "@/components/QtyControls";
import { useWakeLock } from "@/hooks/useWakeLock";
import { playSuccessBeep, playErrorBeep, playCompleteFanfare } from "@/lib/sounds";

const BarcodeScanner = lazy(() =>
  import("@/components/BarcodeScanner").then((m) => ({ default: m.BarcodeScanner })),
);
const CameraDetector = lazy(() =>
  import("@/components/CameraDetector").then((m) => ({ default: m.CameraDetector })),
);
const VoiceConference = lazy(() =>
  import("@/components/VoiceConference").then((m) => ({ default: m.VoiceConference })),
);

export const Route = createFileRoute("/recebimentos/$id")({
  component: ConferenciaPage,
});

type Item = {
  id: string;
  ean: string;
  descricao: string;
  unidade: string;
  qtd_esperada: number;
  qtd_conferida: number;
  lote: string | null;
  validade: string | null;
  status: string;
};

function ConferenciaPage() {
  const { id } = useParams({ from: "/recebimentos/$id" });
  const qc = useQueryClient();
  const [scanInput, setScanInput] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "conferidos" | "divergencias">("todos");
  const [historico, setHistorico] = useState<{ ean: string; descricao: string; qtd: number; at: number }[]>([]);
  const [showHist, setShowHist] = useState(false);
  const [qtyMultiplier, setQtyMultiplier] = useState<number>(1);
  const [lastChangedId, setLastChangedId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useWakeLock(true);

  const flashItem = (itemId: string) => {
    setLastChangedId(itemId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setLastChangedId(null), 700);
  };

  const { data: receb, isLoading: recebLoading, isError: recebError } = useQuery({
    queryKey: ["recebimento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: itens = [], refetch } = useQuery({
    queryKey: ["itens", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimento_itens")
        .select("*")
        .eq("recebimento_id", id)
        .order("descricao");
      if (error) throw error;
      return data as Item[];
    },
  });

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel(`itens-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recebimento_itens", filter: `recebimento_id=eq.${id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, refetch]);

  const totals = useMemo(() => {
    const conferidos = itens.filter((i) => i.qtd_conferida >= i.qtd_esperada).length;
    const divergencias = itens.filter(
      (i) => i.qtd_conferida > 0 && i.qtd_conferida !== i.qtd_esperada,
    ).length;
    return { conferidos, divergencias, total: itens.length };
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (q && !(i.descricao.toLowerCase().includes(q) || i.ean.includes(q))) return false;
      const qc = Number(i.qtd_conferida);
      const qe = Number(i.qtd_esperada);
      if (filtro === "pendentes") return qc < qe;
      if (filtro === "conferidos") return qc >= qe && qc > 0;
      if (filtro === "divergencias") return qc > 0 && qc !== qe;
      return true;
    });
  }, [itens, busca, filtro]);

  const addQty = async (itemId: string, delta: number) => {
    const item = itens.find((i) => i.id === itemId);
    if (!item) return;
    const novaQtd = Math.max(0, Number(item.qtd_conferida) + delta);
    const novoStatus =
      novaQtd === 0
        ? "pendente"
        : novaQtd === Number(item.qtd_esperada)
        ? "ok"
        : novaQtd > Number(item.qtd_esperada)
        ? "sobra"
        : "divergencia";

    setActiveId(item.id);
    flashItem(item.id);

    // Optimistic update — atualiza UI imediatamente
    const prev = qc.getQueryData<Item[]>(["itens", id]);
    qc.setQueryData<Item[]>(["itens", id], (old) =>
      (old ?? []).map((i) =>
        i.id === item.id ? { ...i, qtd_conferida: novaQtd, status: novoStatus } : i,
      ),
    );

    const { error } = await supabase
      .from("recebimento_itens")
      .update({ qtd_conferida: novaQtd, status: novoStatus })
      .eq("id", item.id);

    if (error) {
      // Rollback
      if (prev) qc.setQueryData(["itens", id], prev);
      toast.error("Falha ao atualizar item");
      return;
    }
    if ("vibrate" in navigator) navigator.vibrate(delta > 0 ? 25 : 15);
    // Realtime subscription cuidará da reconciliação se houver mudança externa.
  };

  const setQty = async (itemId: string, qtd: number) => {
    const item = itens.find((i) => i.id === itemId);
    if (!item) return;
    await addQty(itemId, qtd - Number(item.qtd_conferida));
  };

  const updateQuantity = (item: Item, delta: number) => addQty(item.id, delta);

  const playCompleteSound = () => {
    playCompleteFanfare();
  };

  const [finalizando, setFinalizando] = useState(false);

  const finalizarNota = async () => {
    setFinalizando(true);
    const pendentes = itens.filter((i) => Number(i.qtd_conferida) < Number(i.qtd_esperada));
    if (pendentes.length > 0) {
      const results = await Promise.all(
        pendentes.map((i) =>
          supabase
            .from("recebimento_itens")
            .update({ qtd_conferida: Number(i.qtd_esperada), status: "ok" })
            .eq("id", i.id),
        ),
      );
      if (results.find((r) => r.error)) {
        setFinalizando(false);
        toast.error("Falha ao conferir todos os itens");
        return;
      }
      qc.invalidateQueries({ queryKey: ["itens", id] });
    }
    const novoStatus = totals.divergencias > 0 ? "com_divergencia" : "finalizado";
    const { error } = await supabase
      .from("recebimentos")
      .update({ status: novoStatus, finalizado_at: new Date().toISOString() })
      .eq("id", id);
    setFinalizando(false);
    if (error) {
      toast.error("Falha ao finalizar nota");
      return;
    }
    playCompleteSound();
    toast.success("Nota conferida!", { description: `NF #${receb?.numero_nf}` });
    qc.invalidateQueries({ queryKey: ["recebimento", id] });
    qc.invalidateQueries({ queryKey: ["recebimentos"] });
  };

  const applyDetected = async (itemId: string, qtd: number) => {
    const item = itens.find((i) => i.id === itemId);
    if (!item) return;
    const novaQtd = Number(item.qtd_conferida) + qtd;
    const novoStatus =
      novaQtd === Number(item.qtd_esperada)
        ? "ok"
        : novaQtd > Number(item.qtd_esperada)
        ? "sobra"
        : "divergencia";
    const { error } = await supabase
      .from("recebimento_itens")
      .update({ qtd_conferida: novaQtd, status: novoStatus })
      .eq("id", itemId);
    if (error) {
      toast.error("Falha ao aplicar detecção");
      return;
    }
    setActiveId(itemId);
    qc.invalidateQueries({ queryKey: ["itens", id] });
    if ("vibrate" in navigator) navigator.vibrate(30);
  };

  const [scanError, setScanError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = (msg: string) => {
    setScanError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setScanError(null), 3500);
  };

  const processScan = async (code: string) => {
    const found = itens.find((i) => i.ean === code);
    if (!found) {
      playErrorBeep();
      showError(`EAN ${code} não está no romaneio`);
      toast.error("Produto fora da NF", { description: `EAN ${code} não está no romaneio.` });
      return;
    }
    const inc = qtyMultiplier > 0 ? qtyMultiplier : 1;
    if (Number(found.qtd_conferida) >= Number(found.qtd_esperada)) {
      playErrorBeep();
      showError(`${found.descricao} já está completo (${Number(found.qtd_esperada)}/${Number(found.qtd_esperada)})`);
      toast.warning("Quantidade já atingida", { description: found.descricao });
      await updateQuantity(found, inc);
    } else {
      await updateQuantity(found, inc);
      playSuccessBeep();
      toast.success(found.descricao, { description: `+${inc} ${found.unidade}` });
    }
    setActiveId(found.id);
    setHistorico((h) => [
      { ean: found.ean, descricao: found.descricao, qtd: Number(found.qtd_conferida) + inc, at: Date.now() },
      ...h,
    ].slice(0, 30));
    // reset multiplier após uso
    if (qtyMultiplier !== 1) setQtyMultiplier(1);
    setTimeout(() => {
      document.getElementById(`item-${found.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;
    setScanInput("");
    await processScan(code);
    inputRef.current?.focus();
  };

  // Auto-submit quando o scanner USB/Bluetooth envia o código sem Enter.
  // Restringe a padrões numéricos típicos de EAN/UPC/ITF e usa debounce maior
  // para não disparar com digitação manual.
  useEffect(() => {
    const code = scanInput.trim();
    if (code.length < 8) return;
    if (!/^\d{8,14}$/.test(code)) return;
    const t = setTimeout(() => {
      if (scanInput.trim() === code) {
        setScanInput("");
        void processScan(code);
        inputRef.current?.focus();
      }
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanInput]);


  if (recebLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-40 animate-pulse rounded-2xl border border-border bg-card/50" />
          <div className="mt-5 h-16 animate-pulse rounded-2xl border border-border bg-card/50" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card/40" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }
  if (recebError || !receb) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-10 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="mt-3 text-lg font-semibold">Recebimento não encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pode ter sido removido ou você não tem acesso a esta loja.
          </p>
          <Link
            to="/recebimentos"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:border-primary/40"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar aos recebimentos
          </Link>
        </div>
      </AppShell>
    );
  }

  const pct = totals.total > 0 ? Math.round((totals.conferidos / totals.total) * 100) : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-8">
        <Link
          to="/recebimentos"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Recebimentos
        </Link>

        {/* Header card */}
        <div className="mt-3 rounded-2xl border border-border bg-gradient-surface p-5 shadow-elevated">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11px] text-muted-foreground">
                NF #{receb.numero_nf}
              </div>
              <h1 className="mt-0.5 break-words text-lg font-bold leading-tight tracking-tight sm:text-xl md:text-2xl">
                {receb.fornecedor}
              </h1>
              <div className="mt-1 break-words text-xs text-muted-foreground">
                {receb.loja} · {receb.cnpj ?? "—"}
              </div>
            </div>
            <StatusBadge status={receb.status} />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Mini label="Itens" value={`${totals.total}`} />
            <Mini label="Conferidos" value={`${totals.conferidos}`} tone="success" />
            <Mini label="Divergências" value={`${totals.divergencias}`} tone="destructive" />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Progresso</span>
              <span className="font-mono tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bipagem input */}
        <form
          onSubmit={handleScan}
          className="sticky top-14 z-10 mt-5 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-elevated backdrop-blur md:top-4"
        >
          <div className="flex items-center gap-2">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <ScanLine className="h-5 w-5 text-primary-foreground" />
            </div>
            <input
              ref={inputRef}
              autoFocus
              inputMode="numeric"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Bipar código de barras…"
              className="h-11 w-full bg-transparent text-base font-mono outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow active:scale-95"
              title="Escanear com a câmera"
              onClick={() => setScannerOpen(true)}
            >
              <QrCode className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary sm:grid"
              title="Conferência por voz"
              onClick={() => setVoiceOpen(true)}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary sm:grid"
              title="IA Visual · detectar caixas"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 text-xs font-medium text-primary active:scale-[0.98]"
            >
              <Mic className="h-3.5 w-3.5" /> Voz
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 text-xs font-medium text-primary active:scale-[0.98]"
            >
              <Camera className="h-3.5 w-3.5" /> IA Caixas
            </button>
            <button
              type="button"
              onClick={() => setShowHist((v) => !v)}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs font-medium active:scale-[0.98]"
            >
              <History className="h-3.5 w-3.5" /> Histórico
            </button>
          </div>
          {/* Multiplicador inteligente: próxima bipagem soma N */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <Zap className="h-3 w-3" /> Próx. bip
            </span>
            {[1, 2, 5, 10, 12, 24].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQtyMultiplier(n)}
                className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold transition active:scale-95 ${
                  qtyMultiplier === n
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "border border-border bg-background text-muted-foreground"
                }`}
              >
                ×{n}
              </button>
            ))}
            {qtyMultiplier !== 1 && (
              <button
                type="button"
                onClick={() => setQtyMultiplier(1)}
                className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                title="Resetar"
              >
                <X className="h-3 w-3" /> reset
              </button>
            )}
          </div>
          {scanError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{scanError}</span>
            </div>
          )}
        </form>

        {/* Histórico */}
        {showHist && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">Últimas leituras</span>
              <span className="text-muted-foreground">{historico.length}</span>
            </div>
            {historico.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhuma leitura ainda.</div>
            ) : (
              <ul className="max-h-56 space-y-1.5 overflow-auto">
                {historico.map((h, i) => (
                  <li key={i} className="flex items-start justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="break-words font-medium leading-snug">{h.descricao}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{h.ean}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono font-bold tabular-nums">+1 → {h.qtd}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(h.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Busca + filtro */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição ou EAN…"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {([
              ["todos", "Todos"],
              ["pendentes", "Pendentes"],
              ["conferidos", "Conferidos"],
              ["divergencias", "Divergências"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFiltro(k)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                  filtro === k
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div className="mt-3 space-y-2">
          {itensFiltrados.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Nenhum item para os filtros aplicados.
            </div>
          )}
          {itensFiltrados.map((item) => {
            const isOk = item.qtd_conferida >= item.qtd_esperada && item.qtd_conferida > 0;
            const isDiv = item.qtd_conferida > 0 && item.qtd_conferida !== item.qtd_esperada;
            return (
              <div
                key={item.id}
                id={`item-${item.id}`}
                className={`rounded-2xl border p-3.5 transition-all ${
                  activeId === item.id
                    ? "border-primary bg-primary/5 shadow-glow"
                    : isOk
                    ? "border-success/30 bg-card"
                    : isDiv
                    ? "border-destructive/30 bg-card"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isOk && <Check className="h-3.5 w-3.5 text-success" />}
                      {isDiv && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.ean}
                      </span>
                    </div>
                    <div className="mt-0.5 break-words text-sm font-semibold leading-snug">
                      {item.descricao}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {item.lote && <span className="break-all">Lote {item.lote}</span>}
                      {item.validade && <span>· Val. {formatDate(item.validade)}</span>}
                    </div>
                  </div>

                  <QtyControls
                    qtdConferida={Number(item.qtd_conferida)}
                    qtdEsperada={Number(item.qtd_esperada)}
                    unidade={item.unidade}
                    highlight={lastChangedId === item.id}
                    onDelta={(d) => updateQuantity(item, d)}
                    onSet={(q) => setQty(item.id, q)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Finalizar */}
        <div className="sticky bottom-3 mt-6 z-10">
          <button
            onClick={finalizarNota}
            disabled={finalizando || receb.status === "finalizado" || receb.status === "com_divergencia"}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-4 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.99] disabled:opacity-60 sm:text-base"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="break-words text-center leading-tight">
              {receb.status === "finalizado" || receb.status === "com_divergencia"
                ? "Nota já finalizada"
                : finalizando
                ? "Finalizando…"
                : totals.conferidos === totals.total
                ? "Nota conferida"
                : `Conferir todos e finalizar (${totals.total - totals.conferidos} restantes)`}
            </span>
          </button>
        </div>
      </div>

      {/* Microfone flutuante (FAB) — sempre acessível */}
      {!voiceOpen && (
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          aria-label="Abrir conferência por voz"
          className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow active:scale-95 sm:bottom-6"
        >
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-mic-ping" aria-hidden />
          <Mic className="relative h-6 w-6" />
        </button>
      )}

      <Suspense fallback={null}>
        {scannerOpen && (
          <BarcodeScanner
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDetect={(code) => void processScan(code)}
          />
        )}
        {cameraOpen && (
          <CameraDetector
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            itens={itens}
            onApply={applyDetected}
          />
        )}
        {voiceOpen && (
          <VoiceConference
            open={voiceOpen}
            onClose={() => setVoiceOpen(false)}
            itens={itens}
            activeId={activeId}
            onSelect={(itemId) => setActiveId(itemId)}
            onAddQty={addQty}
            onSetQty={setQty}
            onFinalizar={async () => {
              await finalizarNota();
              setVoiceOpen(false);
            }}
          />
        )}
      </Suspense>
    </AppShell>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  const color =
    tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
