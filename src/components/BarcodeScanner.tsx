import { useCallback, useEffect, useRef, useState } from "react";
import { X, Zap, ZapOff, RotateCcw, Loader2 } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void; // chamada para cada código válido
  /** ms entre leituras do mesmo código */
  cooldownMs?: number;
};

const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.ITF,
];

type DetectorLike = {
  detect: (s: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

export function BarcodeScanner({ open, onClose, onDetect, cooldownMs = 1500 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const lastRef = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const lastHitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [lastHit, setLastHit] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);

  const handleHit = useCallback(
    (code: string) => {
      const c = code.trim();
      if (!c) return;
      const now = Date.now();
      if (lastRef.current.code === c && now - lastRef.current.t < cooldownMs) return;
      lastRef.current = { code: c, t: now };
      setLastHit(c);
      if (lastHitTimerRef.current) clearTimeout(lastHitTimerRef.current);
      lastHitTimerRef.current = setTimeout(() => setLastHit((v) => (v === c ? null : v)), 600);
      onDetect(c);
    },
    [cooldownMs, onDetect],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      setStatus("starting");
      setErrorMsg(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        await v.play().catch(() => {});

        // Verifica torch
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean;
        };
        setTorchAvailable(!!caps.torch);

        // 1) Tenta BarcodeDetector nativo
        const native = (
          window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }
        ).BarcodeDetector;
        if (native) {
          const detector = new native({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"],
          });
          let raf = 0;
          const loop = async () => {
            if (cancelled) return;
            try {
              const codes = await detector.detect(v);
              if (codes && codes.length > 0) handleHit(codes[0].rawValue);
            } catch {
              /* frame error – ignora */
            }
            raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
          stopRef.current = () => cancelAnimationFrame(raf);
          setStatus("scanning");
          return;
        }

        // 2) Fallback ZXing
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const controls = await reader.decodeFromStream(stream, v, (result) => {
          if (result) handleHit(result.getText());
        });
        stopRef.current = () => controls.stop();
        setStatus("scanning");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao acessar câmera";
        setErrorMsg(msg);
        setStatus("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (lastHitTimerRef.current) clearTimeout(lastHitTimerRef.current);
      lastHitTimerRef.current = null;
      setTorchOn(false);
      setTorchAvailable(false);
      setLastHit(null);
    };
  }, [handleHit, open, restartKey]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-2 px-3 py-3 text-white">
        <div className="text-sm font-semibold">Escanear · câmera</div>
        <div className="flex items-center gap-2">
          {torchAvailable && (
            <button
              onClick={toggleTorch}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 active:scale-95"
              aria-label="Lanterna"
            >
              {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 active:scale-95"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
        {/* Overlay alvo */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-44 w-[82%] max-w-[420px] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <span className="absolute -top-px left-0 h-6 w-6 rounded-tl-2xl border-l-4 border-t-4 border-primary" />
            <span className="absolute -top-px right-0 h-6 w-6 rounded-tr-2xl border-r-4 border-t-4 border-primary" />
            <span className="absolute -bottom-px left-0 h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-primary" />
            <span className="absolute -bottom-px right-0 h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-primary" />
            <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-primary/80" />
          </div>
        </div>

        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Iniciando câmera…
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-x-4 top-1/3 rounded-2xl bg-destructive/90 p-4 text-sm text-destructive-foreground">
            <div className="font-semibold">Não foi possível abrir a câmera</div>
            <div className="mt-1 text-xs opacity-90 break-words">{errorMsg}</div>
            <button
              onClick={() => {
                setRestartKey((value) => value + 1);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        )}

        {lastHit && (
          <div className="absolute inset-x-4 bottom-24 rounded-xl bg-success/90 px-3 py-2 text-center font-mono text-sm text-success-foreground shadow-glow animate-in fade-in slide-in-from-bottom-2">
            ✓ {lastHit}
          </div>
        )}
      </div>

      <div className="px-4 py-4 text-center text-xs text-white/80">
        Aponte para o código de barras · leitura automática e contínua
      </div>
    </div>
  );
}
