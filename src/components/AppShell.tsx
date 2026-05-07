import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PackageCheck, ScanBarcode, Boxes, Settings, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/recebimentos", label: "Recebimentos", icon: PackageCheck },
  { to: "/conferencia", label: "Bipar", icon: ScanBarcode, primary: true },
  { to: "/inventario", label: "Inventário", icon: Boxes },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile, user, roles, lojas, isAuditor, signOut } = useAuth();
  const roleLabel = roles[0] ? roles[0][0].toUpperCase() + roles[0].slice(1) : "Sem papel";
  const lojaLabel = isAuditor ? "Todas as lojas" : lojas[0] ?? "Sem loja";

  return (
    <div className="relative min-h-screen pb-24 md:pb-0 md:pl-64">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="rounded-lg bg-card/50 p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Loja ativa
            </div>
            <div className="mt-1 text-sm font-semibold">{lojaLabel}</div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Sincronizado
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
              {(profile?.nome ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{profile?.nome ?? user?.email}</div>
              <div className="truncate text-[10px] text-muted-foreground">{roleLabel}</div>
            </div>
            <button
              onClick={signOut}
              title="Sair"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground">
            {roleLabel}
          </div>
          <button
            onClick={signOut}
            title="Sair"
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <main className="relative">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
          {navItems.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            if (item.primary) {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="-mt-6 flex flex-col items-center justify-center"
                >
                  <div
                    className={cn(
                      "grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow transition-transform",
                      active ? "scale-105" : "scale-100",
                    )}
                  >
                    <Icon className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                    {item.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
