import { useCallback, useEffect, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/lib/storage";

const INTRO_DURATION_MS = 10000;
const STORAGE_KEY = "conferflow:intro:seen";

export function IntroScreen() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(() => {
    writeStorage("session", STORAGE_KEY, "yes");
    setLeaving(true);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => setVisible(false), 650);
  }, []);

  useEffect(() => {
    if (readStorage("session", STORAGE_KEY) === "yes") return;

    setVisible(true);
    const timer = window.setTimeout(finish, INTRO_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, [finish]);

  if (!visible) return null;

  return (
    <div
      className={`intro-screen fixed inset-0 z-[80] overflow-hidden bg-[#020817] text-foreground ${
        leaving ? "intro-screen--leaving" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Introducao ConferFlow"
    >
      <div className="absolute inset-0 intro-grid" />
      <div className="absolute inset-0 intro-vignette" />
      <div className="intro-panel intro-panel-left" />
      <div className="intro-panel intro-panel-right" />
      <div className="intro-scan" />

      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-20 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/80 backdrop-blur transition hover:border-primary/50 hover:text-white sm:right-6"
      >
        Pular intro
      </button>

      <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-5 text-center">
        <div className="intro-mark">
          <img
            src="/brand/conferflow-wide-dark.png"
            alt="ConferFlow"
            className="intro-logo mx-auto w-[min(86vw,860px)] select-none object-contain"
            draggable={false}
          />
        </div>

        <div className="intro-copy mt-8 max-w-xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.36em] text-primary">
            Conferencia que flui
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
            Resultados que contam. Operacao mobile-first para recebimentos, inventario e lojas.
          </p>
        </div>

        <div className="intro-progress mt-10 h-1 w-[min(72vw,420px)] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-primary" />
        </div>
      </div>
    </div>
  );
}
