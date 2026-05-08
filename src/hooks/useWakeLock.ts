import { useEffect } from "react";

type SentinelLike = { release: () => Promise<void> } | null;

/** Mantém a tela ativa (Screen Wake Lock API) enquanto enabled=true. */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let sentinel: SentinelLike = null;
    let cancelled = false;

    const wl = (navigator as unknown as {
      wakeLock?: { request: (t: "screen") => Promise<SentinelLike> };
    }).wakeLock;
    if (!wl) return;

    const acquire = async () => {
      try {
        sentinel = await wl.request("screen");
      } catch {
        /* sem permissão / contexto inseguro */
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible" && !cancelled) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
