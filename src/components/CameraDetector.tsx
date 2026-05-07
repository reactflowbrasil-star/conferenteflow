import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, X, Sparkles, Loader2, Check, AlertTriangle, RefreshCw, Plus } from "lucide-react";

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
  confianca: "alta" | "media" | "baixa";
};

type Deteccao = {
  total_caixas_estimadas: number;
  confianca: "alta" | "media" | "baixa";
  resumo: string;
  sugestoes: Sugestao[];
  alertas: string[];
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
  const [result, setResult] = useState<Deteccao | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      setResult(null);
      setApplied(new Set());
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

  const retake = () => {
    setShot(null);
    setResult(null);
    setApplied(new Set());
  };

  const analyze = async () => {
    if (!shot) return;
    setLoading(true);
    setResult(null);
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
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult(data as Deteccao);
      if ("vibrate" in navigator) navigator.vibrate(20);
    } catch (e) {
      toast.error("IA visual falhou", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = async (sug: Sugestao, idx: number) => {
    const match =
      (sug.ean && itens.find((i) => i.ean === sug.ean)) ||
      itens.find((i) => i.descricao.toLowerCase() === sug.descricao.toLowerCase());
    if (!match) {
      toast.error("Item não está na NF", { description: sug.descricao });
      return;
    }
    await onApply(match.id, sug.qtd_detectada);
    setApplied((prev) => new Set(prev).add(idx));
    toast.success(`+${sug.qtd_detectada} ${match.unidade}`, { description: match.descricao });
  };

  if (!open) return null;

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
              IA Visual · Beta
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
        {!shot ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* Reticle */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-2/3 w-[88%] rounded-3xl border-2 border-primary/70 shadow-glow" />
            </div>
            {!ready && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </>
        ) : (
          <img src={shot} alt="captura" className="h-full w-full object-contain" />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Result overlay */}
        {result && (
          <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto rounded-t-3xl border-t border-primary/30 bg-card/95 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Detecção · confiança {result.confianca}
                </div>
                <div className="text-lg font-bold">
                  ~{result.total_caixas_estimadas}{" "}
                  <span className="text-sm font-medium text-muted-foreground">caixas estimadas</span>
                </div>
              </div>
              <button
                onClick={retake}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refazer
              </button>
            </div>

            {result.resumo && (
              <p className="mt-2 text-xs text-muted-foreground">{result.resumo}</p>
            )}

            {result.alertas.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.alertas.map((a, i) => (
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
              {result.sugestoes.map((s, i) => {
                const match =
                  (s.ean && itens.find((it) => it.ean === s.ean)) ||
                  itens.find((it) => it.descricao.toLowerCase() === s.descricao.toLowerCase());
                const ok = applied.has(i);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                      ok ? "border-success/40 bg-success/5" : "border-border bg-background"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.descricao}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{s.ean || "EAN ?"}</span>
                        <span>· conf. {s.confianca}</span>
                        {!match && <span className="text-destructive">· fora da NF</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold tabular-nums">
                        +{s.qtd_detectada}
                      </span>
                      <button
                        disabled={!match || ok}
                        onClick={() => applySuggestion(s, i)}
                        className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-40"
                        aria-label="Aplicar sugestão"
                      >
                        {ok ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" strokeWidth={3} />}
                      </button>
                    </div>
                  </div>
                );
              })}
              {result.sugestoes.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhum produto identificado. Reposicione a câmera e tente novamente.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Capture controls */}
      {!result && (
        <div className="border-t border-border/60 bg-background px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
          {!shot ? (
            <button
              onClick={capture}
              disabled={!ready}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary text-base font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
              Capturar foto
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={retake}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold"
              >
                <RefreshCw className="h-4 w-4" /> Refazer
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
                    <Sparkles className="h-5 w-5" /> Analisar com IA
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
