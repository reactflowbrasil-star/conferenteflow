import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Pencil, Check } from "lucide-react";
import { useHoldRepeat } from "@/hooks/useHoldRepeat";

type Props = {
  qtdConferida: number;
  qtdEsperada: number;
  unidade: string;
  highlight?: boolean;
  onDelta: (delta: number) => void | Promise<void>;
  onSet: (qtd: number) => void | Promise<void>;
};

/**
 * Controle compacto de quantidade — Mobile First.
 * - Tap +/- para ±1
 * - Segurar +/- para incremento contínuo
 * - Chips +5 / +10 para incremento rápido
 * - Tap no número para edição direta (teclado numérico)
 * - Flash animado quando qtd muda
 */
export function QtyControls({ qtdConferida, qtdEsperada, unidade, highlight, onDelta, onSet }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qtdConferida));
  const [flash, setFlash] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQty = useRef(qtdConferida);

  // Disparar flash quando qty mudar (de fora ou daqui)
  useEffect(() => {
    if (lastQty.current !== qtdConferida) {
      lastQty.current = qtdConferida;
      setFlash((f) => f + 1);
    }
  }, [qtdConferida]);

  useEffect(() => {
    if (editing) {
      setDraft(String(qtdConferida));
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [editing, qtdConferida]);

  const inc = useHoldRepeat(() => onDelta(1));
  const dec = useHoldRepeat(() => onDelta(-1));

  const commitEdit = () => {
    const n = parseInt(draft.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n >= 0) onSet(n);
    setEditing(false);
  };

  const isOver = qtdConferida > qtdEsperada;
  const isOk = qtdConferida >= qtdEsperada && qtdConferida > 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          {...dec}
          className="grid h-10 w-10 select-none place-items-center rounded-lg border border-border bg-background text-muted-foreground active:scale-95"
          aria-label="Diminuir"
        >
          <Minus className="h-4 w-4" />
        </button>

        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              inputMode="numeric"
              pattern="[0-9]*"
              className="h-10 w-16 rounded-lg border border-primary bg-background px-2 text-center font-mono text-lg font-bold tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={commitEdit}
              className="grid h-10 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"
              aria-label="Confirmar"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            key={flash}
            className={`group relative min-w-[72px] select-none rounded-lg px-2 py-1 text-center transition ${
              highlight ? "animate-flash" : ""
            }`}
            aria-label="Editar quantidade"
          >
            <div
              className={`font-mono text-lg font-bold leading-none tabular-nums ${
                isOver ? "text-destructive" : isOk ? "text-success" : "text-foreground"
              }`}
            >
              {qtdConferida}
              <span className="text-muted-foreground">/{qtdEsperada}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
              <Pencil className="h-2.5 w-2.5 opacity-60 transition group-hover:opacity-100" />
              {unidade}
            </div>
          </button>
        )}

        <button
          type="button"
          {...inc}
          className="grid h-10 w-10 select-none place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow active:scale-95"
          aria-label="Aumentar"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>

      {/* Chips de incremento rápido */}
      <div className="flex items-center gap-1">
        {[5, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onDelta(n)}
            className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary active:scale-95"
          >
            +{n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSet(qtdEsperada)}
          className="rounded-md border border-success/40 bg-success/10 px-2 py-0.5 font-mono text-[11px] font-bold text-success active:scale-95"
          title="Completar quantidade esperada"
        >
          OK
        </button>
      </div>
    </div>
  );
}
