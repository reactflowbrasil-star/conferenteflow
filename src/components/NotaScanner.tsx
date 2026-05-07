import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Camera,
  X,
  Sparkles,
  Loader2,
  RefreshCw,
  FileText,
  Upload,
  Check,
} from "lucide-react";

type ItemNF = {
  codigo?: string;
  descricao: string;
  unidade?: string;
  quantidade: number;
  preco_unitario?: number;
  valor_total?: number;
};

type NF = {
  numero_nf: string;
  serie?: string;
  chave_acesso?: string;
  fornecedor: string;
  cnpj?: string;
  data_emissao?: string;
  valor_total?: number;
  confianca: "alta" | "media" | "baixa";
  observacao?: string;
  itens: ItemNF[];
};

export function NotaScanner({
  open,
  onClose,
  loja = "Loja Centro · 01",
}: {
  open: boolean;
  onClose: () => void;
  loja?: string;
}) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nf, setNf] = useState<NF | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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
        console.warn("camera unavailable", e);
        // Fallback to file picker; not fatal
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
      setShot(null);
      setNf(null);
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 1920;
    const h = video.videoHeight || 1080;
    canvas.width = Math.min(w, 1600);
    canvas.height = Math.round((canvas.width / w) * h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.85));
  };

  const onFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setShot(reader.result as string);
    reader.readAsDataURL(f);
  };

  const retake = () => {
    setShot(null);
    setNf(null);
  };

  const analyze = async () => {
    if (!shot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ler-nota", {
        body: { imageBase64: shot },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setNf(data as NF);
      if ("vibrate" in navigator) navigator.vibrate(25);
    } catch (e) {
      toast.error("Não consegui ler a NF", {
        description: e instanceof Error ? e.message : "Tente uma foto mais nítida.",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAndStart = async () => {
    if (!nf) return;
    setSaving(true);
    try {
      const totalItens = nf.itens.length;
      const { data: receb, error } = await supabase
        .from("recebimentos")
        .insert({
          numero_nf: nf.numero_nf || "—",
          fornecedor: nf.fornecedor || "Fornecedor desconhecido",
          cnpj: nf.cnpj ?? null,
          loja,
          status: "em_conferencia",
          total_itens: totalItens,
          total_conferidos: 0,
          total_divergencias: 0,
          observacoes: nf.observacao ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      if (totalItens > 0) {
        const rows = nf.itens.map((it) => ({
          recebimento_id: receb.id,
          ean: (it.codigo || "").toString(),
          descricao: it.descricao,
          unidade: (it.unidade || "UN").toUpperCase(),
          qtd_esperada: Number(it.quantidade) || 0,
          qtd_conferida: 0,
          preco_unitario: it.preco_unitario ?? null,
          status: "pendente",
        }));
        const { error: itErr } = await supabase.from("recebimento_itens").insert(rows);
        if (itErr) throw itErr;
      }

      toast.success("NF importada", { description: `${totalItens} itens prontos para conferência.` });
      onClose();
      navigate({ to: "/recebimentos/$id", params: { id: receb.id } });
    } catch (e) {
      toast.error("Falha ao salvar NF", {
        description: e instanceof Error ? e.message : "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              IA · Leitura de NF-e
            </div>
            <div className="text-sm font-semibold">Fotografar nota fiscal</div>
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

      <div className="relative flex-1 overflow-hidden bg-black">
        {!shot ? (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-[78%] w-[90%] rounded-2xl border-2 border-primary/70 shadow-glow" />
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-3 px-4 text-center text-[11px] font-medium uppercase tracking-widest text-primary">
              Enquadre o DANFE inteiro
            </div>
            {!ready && (
              <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </>
        ) : (
          <img src={shot} alt="NF capturada" className="h-full w-full object-contain" />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {nf && (
          <div className="absolute inset-x-0 bottom-0 max-h-[80%] overflow-y-auto rounded-t-3xl border-t border-primary/30 bg-card/95 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  NF #{nf.numero_nf || "—"}
                  {nf.serie && ` · Série ${nf.serie}`} · conf. {nf.confianca}
                </div>
                <div className="mt-0.5 truncate text-base font-bold">{nf.fornecedor || "—"}</div>
                <div className="text-[11px] text-muted-foreground">
                  {nf.cnpj || "CNPJ ?"}
                  {nf.data_emissao && ` · ${nf.data_emissao}`}
                  {typeof nf.valor_total === "number" &&
                    ` · R$ ${nf.valor_total.toFixed(2).replace(".", ",")}`}
                </div>
              </div>
              <button
                onClick={retake}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refazer
              </button>
            </div>

            {nf.chave_acesso && (
              <div className="mt-2 break-all rounded-lg bg-background px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                {nf.chave_acesso}
              </div>
            )}

            <div className="mt-3 mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
              <span>Itens detectados</span>
              <span className="font-mono">{nf.itens.length}</span>
            </div>
            <div className="space-y-1.5">
              {nf.itens.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.descricao}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{it.codigo || "—"}</span>
                      {typeof it.preco_unitario === "number" && (
                        <span>· R$ {it.preco_unitario.toFixed(2).replace(".", ",")}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold tabular-nums">
                      {Number(it.quantidade)}
                      <span className="text-muted-foreground"> {it.unidade || "UN"}</span>
                    </div>
                  </div>
                </div>
              ))}
              {nf.itens.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhum item identificado. Refaça a foto com mais luz.
                </div>
              )}
            </div>

            <button
              onClick={saveAndStart}
              disabled={saving || !nf.numero_nf}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary text-base font-bold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" /> Iniciar conferência
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {!nf && (
        <div className="border-t border-border/60 bg-background px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
          {!shot ? (
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"
                aria-label="Enviar arquivo"
              >
                <Upload className="h-5 w-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <button
                onClick={capture}
                disabled={!ready}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-primary text-base font-bold text-primary-foreground shadow-glow disabled:opacity-50"
              >
                <Camera className="h-5 w-5" />
                Capturar nota
              </button>
            </div>
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
                    <Loader2 className="h-5 w-5 animate-spin" /> Lendo NF…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" /> Ler NF com IA
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
