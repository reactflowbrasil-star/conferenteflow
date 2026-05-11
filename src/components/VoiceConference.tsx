import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, X, ChevronUp, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { parsePtNumber, useVoiceCommands } from "@/hooks/useVoiceCommands";

type Item = {
  id: string;
  ean: string;
  descricao: string;
  unidade: string;
  qtd_esperada: number;
  qtd_conferida: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  itens: Item[];
  activeId: string | null;
  onSelect: (itemId: string) => void;
  onAddQty: (itemId: string, delta: number) => void | Promise<void>;
  onSetQty?: (itemId: string, qtd: number) => void | Promise<void>;
  onFinalizar?: () => void | Promise<void>;
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function VoiceConference({ open, onClose, itens, activeId, onSelect, onAddQty, onSetQty, onFinalizar }: Props) {
  const [interim, setInterim] = useState("");
  const [log, setLog] = useState<{ id: number; text: string; kind: "in" | "out" | "err" }[]>([]);
  const counterRef = useRef(0);
  const itensRef = useRef(itens);
  const activeRef = useRef(activeId);

  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const push = (text: string, kind: "in" | "out" | "err" = "out") => {
    counterRef.current += 1;
    setLog((l) => [{ id: counterRef.current, text, kind }, ...l].slice(0, 12));
  };

  const findByName = (q: string): Item | null => {
    const nq = normalize(q);
    if (!nq) return null;
    const list = itensRef.current;
    // exact ean
    const byEan = list.find((i) => i.ean === q.replace(/\D/g, ""));
    if (byEan) return byEan;
    // word match score
    const scored = list
      .map((i) => {
        const nd = normalize(i.descricao);
        const tokens = nq.split(/\s+/).filter((t) => t.length > 2);
        const hits = tokens.filter((t) => nd.includes(t)).length;
        return { item: i, hits };
      })
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    return scored[0]?.item ?? null;
  };

  const handleFinal = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    push(text, "in");
    const n = normalize(text);

    // close
    if (/^(fechar|sair|encerrar|cancelar|pausar)\s*(microfone|voz|escuta)?$/.test(n)) {
      push("Fechando voz", "out");
      onClose();
      return;
    }
    // finalizar nota / conferir todos
    if (
      /(finalizar|encerrar|fechar|concluir|terminar)\s+(a\s+)?(nota|conferencia|conferência|romaneio|tudo|todos)/.test(n) ||
      /^(conferir|conferi|marca|marcar)\s+(todos|tudo)(\s+os\s+itens)?$/.test(n) ||
      /^(nota\s+)?conferida$/.test(n) ||
      /^(finalizar|concluir|terminar|pronto|ok\s+tudo|tudo\s+ok|tudo\s+certo)$/.test(n)
    ) {
      if (onFinalizar) {
        push("✓ Finalizando nota…", "out");
        await onFinalizar();
      } else {
        push("Ação não disponível", "err");
      }
      return;
    }
    // navigation
    if (/\b(proximo|próximo|avancar|avançar|seguinte|prossegue|continua)\b/.test(n)) {
      const list = itensRef.current;
      const idx = list.findIndex((i) => i.id === activeRef.current);
      const next = list[Math.min(list.length - 1, (idx < 0 ? -1 : idx) + 1)];
      if (next) {
        onSelect(next.id);
        push(`▶ ${next.descricao}`);
      }
      return;
    }
    if (/\b(anterior|voltar|volta)\b/.test(n)) {
      const list = itensRef.current;
      const idx = list.findIndex((i) => i.id === activeRef.current);
      const prev = list[Math.max(0, (idx < 0 ? 1 : idx) - 1)];
      if (prev) {
        onSelect(prev.id);
        push(`◀ ${prev.descricao}`);
      }
      return;
    }
    // search / select  ("buscar arroz", "selecionar leite", "ir para feijão")
    const search = n.match(/^(?:buscar|busca|procurar|procura|item|achar|acha|selecionar|seleciona|ir\s+(?:para|pro|pra)|abrir|abre)\s+(.+)/);
    if (search) {
      const found = findByName(search[1]);
      if (found) {
        onSelect(found.id);
        push(`✓ Selecionado: ${found.descricao}`);
      } else {
        push("Item não encontrado", "err");
      }
      return;
    }
    // ok / completar item
    if (/^(ok|certo|completo|completar|completa|finaliza\s+item|fechou|feito|pronto)$/.test(n)) {
      const list = itensRef.current;
      const item = list.find((i) => i.id === activeRef.current);
      if (!item) return push("Nenhum item ativo", "err");
      const delta = Number(item.qtd_esperada) - Number(item.qtd_conferida);
      if (delta <= 0) return push("Item já conferido", "out");
      await onAddQty(item.id, delta);
      push(`✓ +${delta} ${item.unidade}`);
      return;
    }
    // zerar / limpar
    if (/^(zerar|zera|limpar|limpa|resetar|reset)(\s+item|\s+quantidade)?$/.test(n)) {
      const list = itensRef.current;
      const item = list.find((i) => i.id === activeRef.current);
      if (!item) return push("Nenhum item ativo", "err");
      if (onSetQty) await onSetQty(item.id, 0);
      else await onAddQty(item.id, -Number(item.qtd_conferida));
      push(`= 0 ${item.unidade}`);
      return;
    }

    // Helper: aplica número e (opcional) nome do produto na frase
    const applyNumWithOptionalName = async (
      num: number,
      sign: 1 | -1,
      absolute: boolean,
      rest: string,
    ) => {
      const list = itensRef.current;
      // tenta achar produto na frase (após remover "de", "do", "da", "caixas", etc.)
      const cleaned = rest
        .replace(/\b(de|do|da|dos|das|caixas?|unidades?|pacotes?|pe[cç]as?|itens?|item|para|pro|pra|no|na)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      let target = list.find((i) => i.id === activeRef.current) ?? null;
      if (cleaned) {
        const found = findByName(cleaned);
        if (found) target = found;
      }
      if (!target) return push("Diga 'buscar <produto>' antes da quantidade.", "err");
      onSelect(target.id);
      if (absolute) {
        if (onSetQty) await onSetQty(target.id, num);
        else await onAddQty(target.id, num - Number(target.qtd_conferida));
        push(`= ${num} ${target.unidade} · ${target.descricao}`);
      } else {
        await onAddQty(target.id, sign * num);
        push(`${sign > 0 ? "+" : "−"} ${num} ${target.unidade} · ${target.descricao}`);
      }
    };

    // subtract: "menos 2", "tirar 3 do arroz", "remover 5"
    const sub = n.match(/^(?:menos|tirar|tira|remover|remove|subtrair|diminuir|diminui)\s+(.+)/);
    if (sub) {
      const num = parsePtNumber(sub[1]);
      if (num === null) return push("Quantidade não reconhecida", "err");
      const rest = sub[1].replace(/\b\d+\b|\b\w+\b/, (m) => (parsePtNumber(m) !== null ? "" : m));
      await applyNumWithOptionalName(num, -1, false, rest);
      return;
    }
    // set absolute: "quantidade 20", "definir 12", "total 5", "igual a 8"
    const setAbs = n.match(/^(?:quantidade|qtd|definir|define|total|igual\s+a|ajustar\s+para|ajusta\s+para)\s+(.+)/);
    if (setAbs) {
      const num = parsePtNumber(setAbs[1]);
      if (num === null) return push("Quantidade não reconhecida", "err");
      const rest = setAbs[1].replace(/\b\d+\b|\b\w+\b/, (m) => (parsePtNumber(m) !== null ? "" : m));
      await applyNumWithOptionalName(num, 1, true, rest);
      return;
    }
    // add explicit: "mais 5", "adicionar 10 de arroz", "conferir 12 leite", "somar 3"
    const add = n.match(/^(?:mais|adicionar|adiciona|somar|soma|conferir|conferi|bipar|bipa|incluir|inclui|colocar|coloca|p[oõ]e|botar|bota)\s+(.+)/);
    if (add) {
      const num = parsePtNumber(add[1]);
      if (num === null) return push("Quantidade não reconhecida", "err");
      const rest = add[1].replace(/\b\d+\b|\b\w+\b/, (m) => (parsePtNumber(m) !== null ? "" : m));
      await applyNumWithOptionalName(num, 1, false, rest);
      return;
    }
    // pattern "<produto> <numero>"  ou "<numero> de <produto>"
    const numFirst = n.match(/^(.+?)\s+(?:de|do|da)\s+(.+)$/);
    if (numFirst) {
      const left = parsePtNumber(numFirst[1]);
      if (left !== null) {
        await applyNumWithOptionalName(left, 1, false, numFirst[2]);
        return;
      }
    }
    // bare number => add no item ativo
    const num = parsePtNumber(n);
    if (num !== null) {
      const list = itensRef.current;
      const item = list.find((i) => i.id === activeRef.current);
      if (!item) return push("Nenhum item ativo. Diga 'buscar <produto>'.", "err");
      await onAddQty(item.id, num);
      push(`+ ${num} ${item.unidade}`);
      return;
    }
    push("Não entendi. Tente: 'buscar arroz', '12 de arroz', 'menos 2', 'próximo', 'ok'.", "err");
  };

  const { supported, listening, error, start, stop } = useVoiceCommands({
    onFinal: handleFinal,
    onInterim: setInterim,
  });

  // Auto start when opens — warm up mic with quality constraints first
  useEffect(() => {
    if (!open) {
      stop();
      setInterim("");
      return;
    }
    if (!supported) {
      toast.error("Voz não suportada neste navegador", {
        description: "Use Chrome/Edge no Android ou desktop.",
      });
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
              sampleRate: 48000,
            } as MediaTrackConstraints,
          });
        }
      } catch {
        /* permission may still work via SpeechRecognition */
      }
      if (!cancelled) start();
    })();
    return () => {
      cancelled = true;
      stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeItem = useMemo(
    () => itens.find((i) => i.id === activeId) ?? null,
    [itens, activeId],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm md:items-center">
      <div className="w-full max-w-lg rounded-t-3xl border border-primary/30 bg-card p-5 shadow-elevated md:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`grid h-10 w-10 place-items-center rounded-xl transition-all ${
                listening
                  ? "bg-gradient-primary shadow-glow animate-pulse"
                  : "bg-muted"
              }`}
            >
              {listening ? (
                <Mic className="h-5 w-5 text-primary-foreground" />
              ) : (
                <MicOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">Conferência por voz</div>
              <div className="text-[11px] text-muted-foreground">
                {listening ? "Ouvindo…" : supported ? "Pausado" : "Não suportado"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active item */}
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Item ativo
          </div>
          {activeItem ? (
            <div className="mt-1">
              <div className="break-words text-sm font-semibold leading-snug">{activeItem.descricao}</div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                {Number(activeItem.qtd_conferida)}/{Number(activeItem.qtd_esperada)} {activeItem.unidade}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">
              Diga <span className="font-mono text-foreground">"buscar arroz"</span> para selecionar.
            </div>
          )}
        </div>

        {/* Live transcript */}
        <div className="mt-3 min-h-[44px] rounded-xl border border-dashed border-border bg-background/30 px-3 py-2 font-mono text-sm">
          {interim ? (
            <span className="text-foreground">{interim}…</span>
          ) : (
            <span className="text-muted-foreground">— aguardando comando —</span>
          )}
        </div>

        {/* Log */}
        <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">
          {log.map((l) => (
            <div
              key={l.id}
              className={`flex items-start gap-2 rounded-lg px-2 py-1 text-xs ${
                l.kind === "in"
                  ? "bg-primary/10 text-primary"
                  : l.kind === "err"
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {l.kind === "in" ? (
                <Mic className="mt-0.5 h-3 w-3 shrink-0" />
              ) : l.kind === "err" ? (
                <X className="mt-0.5 h-3 w-3 shrink-0" />
              ) : (
                <Check className="mt-0.5 h-3 w-3 shrink-0" />
              )}
              <span className="font-mono">{l.text}</span>
            </div>
          ))}
        </div>

        {/* Help */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
          <Hint icon="🔢" label='"doze"' desc="+12 no item" />
          <Hint icon="➖" label='"menos 2"' desc="Remove 2" />
          <Hint icon="🔍" label='"buscar arroz"' desc="Seleciona item" />
          <Hint icon="✓" label='"ok"' desc="Completa esperado" />
          <Hint icon={<ChevronDown className="inline h-3 w-3" />} label='"próximo"' desc="Avança" />
          <Hint icon={<ChevronUp className="inline h-3 w-3" />} label='"anterior"' desc="Volta" />
          <Hint icon="🏁" label='"conferir todos"' desc="Finaliza nota" />
          <Hint icon="🏁" label='"finalizar nota"' desc="Encerra conferência" />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
            {error === "not-allowed"
              ? "Permissão de microfone negada."
              : `Erro: ${error}`}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {listening ? (
            <button
              onClick={stop}
              className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold"
            >
              Pausar
            </button>
          ) : (
            <button
              onClick={start}
              disabled={!supported}
              className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              Ouvir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Hint({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md border border-border bg-background/30 px-2 py-1">
      <span className="shrink-0">{icon}</span>
      <span className="break-words font-mono text-foreground">{label}</span>
      <span className="ml-auto break-words text-right">{desc}</span>
    </div>
  );
}
