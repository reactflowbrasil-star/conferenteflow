import { ScanLine } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
        <ScanLine className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            WMS · Conferência
          </div>
          <div className="font-extrabold text-base tracking-tight">
            Super <span className="text-gradient-primary">Padrão</span>
          </div>
        </div>
      )}
    </div>
  );
}
