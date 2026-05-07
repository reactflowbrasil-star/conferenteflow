import { useCallback, useEffect, useRef, useState } from "react";

// Minimal types for Web Speech API (not in TS DOM lib)
type SRAlt = { transcript: string; confidence: number };
type SRResult = { isFinal: boolean; 0: SRAlt; length: number };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SRErrorEvent = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceOptions = {
  lang?: string;
  onFinal: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
};

export function useVoiceCommands({ lang = "pt-BR", onFinal, onInterim }: VoiceOptions) {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);

  useEffect(() => {
    onFinalRef.current = onFinal;
    onInterimRef.current = onInterim;
  }, [onFinal, onInterim]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    if (recRef.current) {
      try {
        recRef.current.abort();
      } catch {
        /* noop */
      }
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onerror = (e) => {
      setError(e.error || "Erro no reconhecimento");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
      }
    };
    rec.onend = () => {
      setListening(false);
      // Auto-restart if still wanted (continuous mode dies on silence in some browsers)
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      }
    };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) {
          onFinalRef.current(txt.trim());
        } else {
          interim += txt;
        }
      }
      if (interim && onInterimRef.current) onInterimRef.current(interim.trim());
    };
    recRef.current = rec;
    wantRef.current = true;
    setError(null);
    try {
      rec.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao iniciar");
    }
  }, [lang]);

  const stop = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      wantRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  return { supported, listening, error, start, stop };
}

// --- Number parsing (PT-BR) -------------------------------------------------

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const TENS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

export function parsePtNumber(input: string): number | null {
  const cleaned = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, "");
  // Direct digits
  const digit = cleaned.match(/\b(\d{1,4})\b/);
  if (digit) return parseInt(digit[1], 10);

  const tokens = cleaned.split(/[\s-]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let matched = false;
  for (const tok of tokens) {
    const t = tok.replace(/^e$/, "");
    if (t === "e" || t === "") continue;
    if (HUNDREDS[t] !== undefined) {
      current += HUNDREDS[t];
      matched = true;
    } else if (TENS[t] !== undefined) {
      current += TENS[t];
      matched = true;
    } else if (UNITS[t] !== undefined) {
      current += UNITS[t];
      matched = true;
    } else if (t === "mil") {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      matched = true;
    }
  }
  if (!matched) return null;
  return total + current;
}
