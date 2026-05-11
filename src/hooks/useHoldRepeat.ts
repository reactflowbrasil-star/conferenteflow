import { useCallback, useEffect, useRef } from "react";

/**
 * Retorna props para um botão que repete a ação enquanto pressionado.
 * - 1ª execução imediata (no press)
 * - depois de `delay`ms começa a repetir a cada `interval`ms
 */
export function useHoldRepeat(action: () => void, opts?: { delay?: number; interval?: number }) {
  const delay = opts?.delay ?? 380;
  const interval = opts?.interval ?? 90;
  const actionRef = useRef(action);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    actionRef.current();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => actionRef.current(), interval);
    }, delay);
  }, [delay, interval, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };
}
