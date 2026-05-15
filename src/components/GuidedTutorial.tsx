import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Step = {
  key: string;
  title: string;
  description: string;
};

const STORAGE_KEY = "conferflow:tutorial:v1";

const steps: Step[] = [
  {
    key: "painel",
    title: "Painel",
    description:
      "Acompanhe os indicadores do turno, notas recentes e atalhos para iniciar as conferencias mais rapidamente.",
  },
  {
    key: "recebimentos",
    title: "Recebimentos",
    description:
      "Consulte NFs pendentes, filtre por status, busque fornecedor ou loja e abra cada recebimento para conferir item por item.",
  },
  {
    key: "bipar",
    title: "Bipar",
    description:
      "Use a leitura de codigo de barras, camera, voz e recursos de IA para acelerar a conferencia no fluxo mobile.",
  },
  {
    key: "inventario",
    title: "Inventario",
    description:
      "Acesse a area de estoque para organizar contagens, validar saldos e acompanhar divergencias de inventario.",
  },
  {
    key: "ajustes",
    title: "Ajustes",
    description:
      "Gerencie usuarios, supermercados, matriz, filiais e defina o tipo de acesso de cada usuario por loja.",
  },
];

type HighlightRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export function GuidedTutorial() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const step = steps[current];

  const progress = useMemo(() => Math.round(((current + 1) / steps.length) * 100), [current]);

  useEffect(() => {
    const start = () => {
      setCurrent(0);
      setOpen(true);
    };
    window.addEventListener("conferflow:start-tutorial", start);
    return () => window.removeEventListener("conferflow:start-tutorial", start);
  }, []);

  useEffect(() => {
    if (!session) return;
    if (localStorage.getItem(STORAGE_KEY) === "done") return;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    if (!open) return;

    const updateRect = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.key}"]`));
      const target = nodes.find((node) => {
        const box = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });

      if (!target) {
        setRect(null);
        return;
      }

      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      const box = target.getBoundingClientRect();
      setRect({
        height: box.height,
        left: box.left,
        top: box.top,
        width: box.width,
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, step.key]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const close = (remember = false) => {
    if (remember) localStorage.setItem(STORAGE_KEY, "done");
    setOpen(false);
  };

  const previous = () => setCurrent((value) => Math.max(0, value - 1));
  const next = () => {
    if (current === steps.length - 1) {
      close(true);
      return;
    }
    setCurrent((value) => Math.min(steps.length - 1, value + 1));
  };

  if (!session || !open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />

      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_oklch(0_0_0/0.35),0_0_40px_oklch(0.64_0.22_255/0.55)] transition-all duration-200"
          style={{
            height: rect.height + 12,
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
          }}
        />
      )}

      <div className="absolute inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-elevated sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Tutorial {current + 1}/{steps.length}
            </div>
            <h2 id="tour-title" className="mt-1 text-lg font-bold tracking-tight">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => close(true)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            aria-label="Fechar tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={previous}
            disabled={current === 0}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <button
            type="button"
            onClick={next}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {current === steps.length - 1 ? (
              <>
                Concluir
                <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Proximo
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
