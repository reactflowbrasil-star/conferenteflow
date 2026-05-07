import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Boxes } from "lucide-react";

export const Route = createFileRoute("/inventario")({
  component: () => (
    <AppShell>
      <Placeholder title="Inventário" desc="Contagem cíclica e geral por setor — em breve." />
    </AppShell>
  ),
});

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-card">
        <Boxes className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
