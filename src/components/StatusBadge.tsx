import { cn } from "@/lib/utils";
import { statusLabels } from "@/lib/format";

const palette: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground border-border",
  em_conferencia: "bg-accent/15 text-accent border-accent/30",
  finalizado: "bg-success/15 text-success border-success/30",
  com_divergencia: "bg-destructive/15 text-destructive border-destructive/30",
  ok: "bg-success/15 text-success border-success/30",
  divergencia: "bg-destructive/15 text-destructive border-destructive/30",
  sobra: "bg-warning/15 text-warning border-warning/30",
  falta: "bg-destructive/15 text-destructive border-destructive/30",
  avaria: "bg-warning/15 text-warning border-warning/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        palette[status] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status] ?? status}
    </span>
  );
}
