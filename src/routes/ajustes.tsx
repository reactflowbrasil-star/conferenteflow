import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, UserCog, Store, Plus, Trash2, Mail } from "lucide-react";

export const Route = createFileRoute("/ajustes")({
  component: AjustesPage,
});

const ROLES: AppRole[] = ["conferente", "supervisor", "auditor"];

function AjustesPage() {
  const { profile, user, roles, lojas, isAuditor, isSupervisor } = useAuth();
  const roleLabel = roles[0] ?? "sem papel";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu perfil, papéis e acesso.</p>
        </div>

        {/* Perfil */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-lg font-bold text-primary-foreground">
              {(profile?.nome ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{profile?.nome ?? "Sem nome"}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {user?.email}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Mini icon={<Shield className="h-3.5 w-3.5" />} label="Papel" value={roleLabel} />
            <Mini
              icon={<Store className="h-3.5 w-3.5" />}
              label="Lojas"
              value={isAuditor ? "todas" : `${lojas.length}`}
            />
          </div>
        </section>

        {isSupervisor ? (
          <SupervisorPanel />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
            Apenas supervisores podem gerenciar papéis e lojas. Peça a um supervisor para liberar seu acesso.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-sm font-semibold capitalize">{value}</div>
    </div>
  );
}

type UserRow = {
  id: string;
  nome: string | null;
  email: string | null;
};

function SupervisorPanel() {
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["sup", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,email")
        .order("nome");
      if (error) throw error;
      return data as UserRow[];
    },
  });

  const { data: rolesByUser = {} } = useQuery({
    queryKey: ["sup", "roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      const map: Record<string, AppRole[]> = {};
      for (const r of data ?? []) {
        const uid = r.user_id as string;
        const role = r.role as AppRole;
        map[uid] = [...(map[uid] ?? []), role];
      }
      return map;
    },
  });

  const { data: lojasByUser = {} } = useQuery({
    queryKey: ["sup", "lojas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_lojas").select("user_id, loja, id");
      if (error) throw error;
      const map: Record<string, { id: string; loja: string }[]> = {};
      for (const r of data ?? []) {
        const uid = r.user_id as string;
        map[uid] = [...(map[uid] ?? []), { id: r.id as string, loja: r.loja as string }];
      }
      return map;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sup", "roles"] });
    qc.invalidateQueries({ queryKey: ["sup", "lojas"] });
  };

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    if (has) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    refresh();
  };

  const addLoja = async (userId: string, loja: string) => {
    const trimmed = loja.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("user_lojas").insert({ user_id: userId, loja: trimmed });
    if (error) return toast.error(error.message);
    refresh();
  };

  const removeLoja = async (rowId: string) => {
    const { error } = await supabase.from("user_lojas").delete().eq("id", rowId);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <UserCog className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Gerenciar usuários</h2>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            roles={rolesByUser[u.id] ?? []}
            lojas={lojasByUser[u.id] ?? []}
            onToggleRole={toggleRole}
            onAddLoja={addLoja}
            onRemoveLoja={removeLoja}
          />
        ))}
        {users.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum usuário cadastrado ainda.
          </div>
        )}
      </div>
    </section>
  );
}

function UserCard({
  user,
  roles,
  lojas,
  onToggleRole,
  onAddLoja,
  onRemoveLoja,
}: {
  user: UserRow;
  roles: AppRole[];
  lojas: { id: string; loja: string }[];
  onToggleRole: (uid: string, role: AppRole, has: boolean) => void;
  onAddLoja: (uid: string, loja: string) => void;
  onRemoveLoja: (rowId: string) => void;
}) {
  const [novaLoja, setNovaLoja] = useState("");

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3">
        <div className="font-semibold">{user.nome ?? "Sem nome"}</div>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Papéis</div>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((r) => {
            const has = roles.includes(r);
            return (
              <button
                key={r}
                onClick={() => onToggleRole(user.id, r, has)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  has
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Lojas (auditor não precisa — vê tudo)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {lojas.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs"
            >
              {l.loja}
              <button
                onClick={() => onRemoveLoja(l.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAddLoja(user.id, novaLoja);
              setNovaLoja("");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2"
          >
            <input
              value={novaLoja}
              onChange={(e) => setNovaLoja(e.target.value)}
              placeholder="Loja 02"
              className="h-7 w-24 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            <button type="submit" className="text-primary">
              <Plus className="h-3 w-3" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
