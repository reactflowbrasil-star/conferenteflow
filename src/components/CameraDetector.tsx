import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Camera,
  X,
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  RefreshCw,
  Plus,
  Layers,
  Package,
  Trash2,
} from "lucide-react";

type ItemCtx = {
  id: string;
  ean: string;
  descricao: string;
  unidade: string;
  qtd_esperada: number;
  qtd_conferida: number;
};

type Sugestao = {
  ean?: string;
  descricao: string;
  qtd_detectada: number;
  caixas_detectadas?: number;
  unidades_por_caixa?: number;
  tipo_embalagem?: "caixa_master" | "unidade" | "desconhecida";
  confianca: "alta" | "media" | "baixa";
};

type Deteccao = {
  total_caixas_estimadas: number;
  confianca: "alta" | "media" | "baixa";
  resumo: string;
  sugestoes: Sugestao[];
  alertas: string[];
};

type Captura = {
  id: string;
  shot: string;
  result: Deteccao | null;
};

type Acumulado = {
  key: string; // ean || descricao lower
  ean?: string;
  descricao: string;
  qtd: number;
  caixas: number;
  unidades_por_caixa: number;
  tipo: Sugestao["tipo_embalagem"];
};

export function CameraDetector({
  open,
  onClose,
  itens,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  itens: ItemCtx[];
  onApply: (itemId: string, qtd: number) => Promise<void> | void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setReady(true);
        }
      } catch (e) {
        console.error(e);
        toast.error("Câmera indisponível", {
          description: "Permita o acesso à câmera ou use HTTPS.",
        });
        onClose();
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
      setShot(null);
      setCapturas([]);
      setAppliedKeys(new Set());
    };
  }, [open, onClose]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = Math.min(w, 1024);
    canvas.height = Math.round((canvas.width / w) * h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
    setShot(dataUrl);
  };

  const discardShot = () => setShot(null);

  const analyze = async () => {
    if (!shot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("detectar-caixas", {
        body: {
          imageBase64: shot,
          itens: itens.map(({ ean, descricao, unidade, qtd_esperada, qtd_conferida }) => ({
            ean,
            descricao,
            unidade,
            qtd_esperada: Number(qtd_esperada),
            qtd_conferida: Number(qtd_conferida),
          })),
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      const result = data as Deteccao;
      setCapturas((prev) => [
        ...prev,
        { id: crypto.randomUUID(), shot, result },
      ]);
      setShot(null);
      if ("vibrate" in navigator) navigator.vibrate(20);
    } catch (e) {
      toast.error("IA visual falhou", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeCaptura = (id: string) => {
    setCapturas((prev) => prev.filter((c) => c.id !== id));
  };

  // Aggregate suggestions across all captures
  const acumulado = (() => {
    const map = new Map<string, Acumulado>();
    for (const cap of capturas) {
      if (!cap.result) continue;
      for (const s of cap.result.sugestoes) {
        const key = (s.ean || s.descricao.toLowerCase()).trim();
        const existing = map.get(key);
        if (existing) {
          existing.qtd += s.qtd_detectada;
          existing.caixas += s.caixas_detectadas ?? 0;
        } else {
          map.set(key, {
            key,
            ean: s.ean,
            descricao: s.descricao,
            qtd: s.qtd_detectada,
            caixas: s.caixas_detectadas ?? 0,
            unidades_por_caixa: s.unidades_por_caixa ?? 1,
            tipo: s.tipo_embalagem,
          });
        }
      }
    }
    return Array.from(map.values());
  })();

  const alertas = capturas.flatMap((c) => c.result?.alertas ?? []);
  const totalCaixas = capturas.reduce(
    (n, c) => n + (c.result?.total_caixas_estimadas ?? 0),
    0,
  );

  const applyAcumulado = async (acc: Acumulado) => {
    const match =
      (acc.ean && itens.find((i) => i.ean === acc.ean)) ||
      itens.find((i) => i.descricao.toLowerCase() === acc.descricao.toLowerCase());
    if (!match) {
      toast.error("Item não está na NF", { description: acc.descricao });
      return;
    }
    await onApply(match.id, acc.qtd);
    setAppliedKeys((prev) => new Set(prev).add(acc.key));
    toast.success(`+${acc.qtd} ${match.unidade}`, { description: match.descricao });
  };

  const applyAll = async () => {
    for (const acc of acumulado) {
      if (appliedKeys.has(acc.key)) continue;
      const match =
        (acc.ean && itens.find((i) => i.ean === acc.ean)) ||
        itens.find((i) => i.descricao.toLowerCase() === acc.descricao.toLowerCase());
      if (!match) continue;
      await onApply(match.id, acc.qtd);
      setAppliedKeys((prev) => new Set(prev).add(acc.key));
    }
    toast.success("Sugestões aplicadas");
  };

  if (!open) return null;

  const showingResults = capturas.length > 0 && !shot;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              IA Visual · {capturas.length > 0 ? `${capturas.length} foto${capturas.length > 1 ? "s" : ""}` : "Beta"}
            </div>
            <div className="text-sm font-semibold">Detectar caixas</div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Camera / preview */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {shot ? (
          <img src={shot} alt="captura" className="h-full w-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-2/3 w-[88%] rounded-3xl border-2 border-primary/70 shadow-glow" />
            </div>
            {!ready && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {/* Thumbnails strip */}
            {capturas.length > 0 && (
              <div className="absolute left-3 top-3 flex max-w-[60%] flex-wrap gap-2">
                {capturas.map((c, i) => (
                  <div
                    key={c.id}
                    className="group relative h-14 w-14 overflow-hidden rounded-lg border border-primary/50 shadow-glow"
                  >
                    <img src={c.shot} alt={`foto ${i + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 font-mono text-[9px] text-primary-foreground">
                      {i + 1}
                    </span>
                    <button
                      onClick={() => removeCaptura(c.id)}
                      className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded bg-destructive/90 text-destructive-foreground"
                      aria-label="Remover"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Aggregated results overlay */}
        {showingResults && (
          <div className="absolute inset-x-0 bottom-0 max-h-[72%] overflow-y-auto rounded-t-3xl border-t border-primary/30 bg-card/95 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Acumulado · {capturas.length} foto{capturas.length > 1 ? "s" : ""}
                </div>
                <div className="text-lg font-bold">
                  ~{totalCaixas}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    caixas no total
                  </span>
                </div>
              </div>
              {acumulado.length > 0 && (
                <button
                  onClick={applyAll}
                  className="rounded-xl bg-gradient-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-glow"
                >
                  Aplicar tudo
                </button>
              )}
            </div>

            {alertas.length > 0 && (
              <div className="mt-3 space-y-1">
                {alertas.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-2">
              {acumulado.map((acc) => {
                const match =
                  (acc.ean && itens.find((it) => it.ean === acc.ean)) ||
                  itens.find(
                    (it) => it.descricao.toLowerCase() === acc.descricao.toLowerCase(),
                  );
                const ok = appliedKeys.has(acc.key);
                const isMaster = acc.tipo === "caixa_master" && acc.unidades_por_caixa > 1;
                return (
                  <div
                    key={acc.key}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                      ok ? "border-success/40 bg-success/5" : "border-border bg-background"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{acc.descricao}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="font-mono">{acc.ean || "EAN ?"}</span>
                        {isMaster ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Layers className="h-3 w-3" />
                            {acc.caixas}cx × {acc.unidades_por_caixa}un
                          </span>
                        ) : acc.tipo === "unidade" ? (
                          <span className="inline-flex items-center gap-1">
                            <Package className="h-3 w-3" /> unidades
                          </span>
                        ) : null}
                        {!match && <span className="text-destructive">· fora da NF</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold tabular-nums">
                        +{acc.qtd}
                      </span>
                      <button
                        disabled={!match || ok}
                        onClick={() => applyAcumulado(acc)}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-40"
                        aria-label="Aplicar"
                      >
                        {ok ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" strokeWidth={3} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {acumulado.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhum produto identificado ainda. Tire mais fotos ou reposicione a câmera.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Capture controls */}
      <div className="border-t border-border/60 bg-background px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        {shot ? (
          <div className="flex gap-2">
            <button
              onClick={discardShot}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold"
            >
              <Trash2 className="h-4 w-4" /> Descartar
            </button>
            <button
              onClick={analyze}
              disabled={loading}
              className="flex h-14 flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-primary text-base font-bold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Analisando…
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" /> Analisar foto
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={capture}
            disabled={!ready}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary text-base font-bold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
            {capturas.length > 0 ? "Adicionar mais uma foto" : "Capturar foto"}
          </button>
        )}
      </div>
    </div>
  );
}
