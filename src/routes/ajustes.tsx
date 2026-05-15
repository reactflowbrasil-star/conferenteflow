import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Mail,
  Pencil,
  Plus,
  Save,
  Search,
  Shield,
  Store,
  Trash2,
  UserCog,
  Users,
  UserX,
  X,
} from "lucide-react";

export const Route = createFileRoute("/ajustes")({
  component: AjustesPage,
});

const ROLES: AppRole[] = ["conferente", "supervisor", "auditor"];
const ROLE_LABEL: Record<AppRole, string> = {
  conferente: "Conferente",
  supervisor: "Supervisor",
  auditor: "Auditor",
};

type Tab = "usuarios" | "lojas";
type UserFilter = "todos" | "sem_acesso" | AppRole;

type UserRow = {
  id: string;
  nome: string | null;
  email: string | null;
};

type SupermercadoRow = {
  id: string;
  nome: string;
  cnpj: string | null;
};

type LojaRow = {
  id: string;
  supermercado_id: string;
  matriz_id: string | null;
  nome: string;
  codigo: string;
  cnpj: string | null;
  tipo: string;
  endereco: string | null;
  ativa: boolean;
};

type UserLojaRoleRow = {
  id: string;
  user_id: string;
  loja_id: string;
  role: AppRole;
};

function AjustesPage() {
  const { profile, user, roles, lojas, lojaRoles, isAuditor, isSupervisor } = useAuth();
  const [tab, setTab] = useState<Tab>("usuarios");
  const roleLabel = roles.map((r) => ROLE_LABEL[r]).join(", ") || "Sem papel";
  const lojaCount = isAuditor ? "todas" : String(new Set(lojas).size);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Perfil, usuários, supermercados, matriz, filiais e acesso por loja.
            </p>
          </div>

          {isSupervisor && (
            <div className="inline-grid grid-cols-2 rounded-xl border border-border bg-card p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab("usuarios")}
                className={`rounded-lg px-3 py-2 transition-colors ${
                  tab === "usuarios"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Usuários
              </button>
              <button
                type="button"
                onClick={() => setTab("lojas")}
                className={`rounded-lg px-3 py-2 transition-colors ${
                  tab === "lojas" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Lojas
              </button>
            </div>
          )}
        </div>

        <section className="mb-6 rounded-2xl border border-border bg-card p-5">
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
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Mini icon={<Shield className="h-3.5 w-3.5" />} label="Papel" value={roleLabel} />
            <Mini icon={<Store className="h-3.5 w-3.5" />} label="Lojas" value={lojaCount} />
            <Mini
              icon={<Check className="h-3.5 w-3.5" />}
              label="Por loja"
              value={isAuditor ? "acesso global" : `${lojaRoles.length} vínculos`}
            />
          </div>
        </section>

        {isSupervisor ? (
          tab === "usuarios" ? (
            <SupervisorUsersPanel />
          ) : (
            <StoresPanel />
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
            Apenas supervisores podem gerenciar usuários, papéis e lojas. Peça a um supervisor para
            liberar seu acesso.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Mini({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function useAdminData() {
  const users = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,email")
        .order("nome", { nullsFirst: false });
      if (error) throw error;
      return data as UserRow[];
    },
  });

  const supermercados = useQuery({
    queryKey: ["admin", "supermercados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supermercados")
        .select("id,nome,cnpj")
        .order("nome");
      if (error) throw error;
      return data as SupermercadoRow[];
    },
  });

  const lojas = useQuery({
    queryKey: ["admin", "lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id,supermercado_id,matriz_id,nome,codigo,cnpj,tipo,endereco,ativa")
        .order("tipo", { ascending: false })
        .order("nome");
      if (error) throw error;
      return data as LojaRow[];
    },
  });

  const globalRoles = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      const map: Record<string, AppRole[]> = {};
      for (const r of data ?? []) {
        const uid = r.user_id as string;
        map[uid] = [...(map[uid] ?? []), r.role as AppRole];
      }
      return map;
    },
  });

  const lojaRoles = useQuery({
    queryKey: ["admin", "lojaRoles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_loja_roles")
        .select("id,user_id,loja_id,role");
      if (error) throw error;
      return data as UserLojaRoleRow[];
    },
  });

  return {
    users: users.data ?? [],
    supermercados: supermercados.data ?? [],
    lojas: lojas.data ?? [],
    globalRoles: globalRoles.data ?? {},
    lojaRoles: lojaRoles.data ?? [],
    loading:
      users.isLoading ||
      supermercados.isLoading ||
      lojas.isLoading ||
      globalRoles.isLoading ||
      lojaRoles.isLoading,
  };
}

function SupervisorUsersPanel() {
  const qc = useQueryClient();
  const { users, supermercados, lojas, globalRoles, lojaRoles, loading } = useAdminData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("todos");
  const [lojaFilter, setLojaFilter] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const usersWithAccess = useMemo(
    () =>
      users.map((user) => {
        const userGlobalRoles = globalRoles[user.id] ?? [];
        const userLojaRoles = lojaRoles.filter((r) => r.user_id === user.id);
        return {
          user,
          globalRoles: userGlobalRoles,
          lojaRoles: userLojaRoles,
          accessCount: userGlobalRoles.length + userLojaRoles.length,
        };
      }),
    [globalRoles, lojaRoles, users],
  );

  const stats = useMemo(
    () => ({
      total: users.length,
      semAcesso: usersWithAccess.filter((u) => u.accessCount === 0).length,
      supervisores: usersWithAccess.filter((u) => u.globalRoles.includes("supervisor")).length,
      vinculosLoja: lojaRoles.length,
    }),
    [lojaRoles.length, users.length, usersWithAccess],
  );

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return usersWithAccess.filter(
      ({ user, globalRoles: roles, lojaRoles: userLojaRoles, accessCount }) => {
        const text = `${user.nome ?? ""} ${user.email ?? ""}`.toLowerCase();
        const matchesSearch = !normalized || text.includes(normalized);
        const matchesFilter =
          filter === "todos" ||
          (filter === "sem_acesso" && accessCount === 0) ||
          (filter !== "sem_acesso" && roles.includes(filter));
        const matchesLoja = !lojaFilter || userLojaRoles.some((r) => r.loja_id === lojaFilter);
        return matchesSearch && matchesFilter && matchesLoja;
      },
    );
  }, [filter, lojaFilter, search, usersWithAccess]);

  const toggleGlobalRole = async (userId: string, role: AppRole, has: boolean) => {
    const query = has
      ? supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : supabase.from("user_roles").insert({ user_id: userId, role });
    const { error } = await query;
    if (error) return toast.error(error.message);
    refresh();
  };

  const addLojaRole = async (userId: string, lojaId: string, role: AppRole) => {
    if (!lojaId) return toast.error("Selecione uma loja.");
    const { error } = await supabase.from("user_loja_roles").insert({
      user_id: userId,
      loja_id: lojaId,
      role,
    });
    if (error) return toast.error(error.message);
    toast.success("Acesso adicionado.");
    refresh();
  };

  const updateProfile = async (userId: string, nome: string, email: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim() || null, email: email.trim() || null })
      .eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado.");
    refresh();
  };

  const removeLojaRole = async (rowId: string) => {
    const { error } = await supabase.from("user_loja_roles").delete().eq("id", rowId);
    if (error) return toast.error(error.message);
    refresh();
  };

  const clearUserAccess = async (userId: string) => {
    const [{ error: globalError }, { error: lojaError }] = await Promise.all([
      supabase.from("user_roles").delete().eq("user_id", userId),
      supabase.from("user_loja_roles").delete().eq("user_id", userId),
    ]);
    const error = globalError ?? lojaError;
    if (error) return toast.error(error.message);
    toast.success("Acessos removidos.");
    refresh();
  };

  return (
    <section>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Gerenciar usuários</h2>
        </div>
        <div className="text-xs text-muted-foreground">
          Usuários aparecem aqui depois do cadastro na tela de login.
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Mini
          icon={<Users className="h-3.5 w-3.5" />}
          label="Usuários"
          value={String(stats.total)}
        />
        <Mini
          icon={<UserX className="h-3.5 w-3.5" />}
          label="Sem acesso"
          value={String(stats.semAcesso)}
        />
        <Mini
          icon={<Shield className="h-3.5 w-3.5" />}
          label="Supervisores"
          value={String(stats.supervisores)}
        />
        <Mini
          icon={<Store className="h-3.5 w-3.5" />}
          label="Vínculos loja"
          value={String(stats.vinculosLoja)}
        />
      </div>

      <div className="mb-4 grid gap-2 rounded-2xl border border-border bg-card p-3 lg:grid-cols-[1fr_180px_240px]">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as UserFilter)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
        >
          <option value="todos">Todos os usuários</option>
          <option value="sem_acesso">Sem acesso</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <select
          value={lojaFilter}
          onChange={(e) => setLojaFilter(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
        >
          <option value="">Todas as lojas</option>
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome} ({l.codigo})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Carregando usuários e lojas...
          </div>
        )}
        {!loading &&
          filteredUsers.map(({ user, globalRoles: userGlobalRoles, lojaRoles: userLojaRoles }) => (
            <UserCard
              key={user.id}
              user={user}
              globalRoles={userGlobalRoles}
              lojaRoles={userLojaRoles}
              lojas={lojas}
              supermercados={supermercados}
              onToggleGlobalRole={toggleGlobalRole}
              onAddLojaRole={addLojaRole}
              onUpdateProfile={updateProfile}
              onRemoveLojaRole={removeLojaRole}
              onClearUserAccess={clearUserAccess}
            />
          ))}
        {!loading && users.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum usuário cadastrado ainda.
          </div>
        )}
        {!loading && users.length > 0 && filteredUsers.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum usuário encontrado com os filtros atuais.
          </div>
        )}
      </div>
    </section>
  );
}

function UserCard({
  user,
  globalRoles,
  lojaRoles,
  lojas,
  supermercados,
  onToggleGlobalRole,
  onAddLojaRole,
  onUpdateProfile,
  onRemoveLojaRole,
  onClearUserAccess,
}: {
  user: UserRow;
  globalRoles: AppRole[];
  lojaRoles: UserLojaRoleRow[];
  lojas: LojaRow[];
  supermercados: SupermercadoRow[];
  onToggleGlobalRole: (uid: string, role: AppRole, has: boolean) => void;
  onAddLojaRole: (uid: string, lojaId: string, role: AppRole) => void;
  onUpdateProfile: (uid: string, nome: string, email: string) => void;
  onRemoveLojaRole: (rowId: string) => void;
  onClearUserAccess: (uid: string) => void;
}) {
  const [lojaId, setLojaId] = useState("");
  const [role, setRole] = useState<AppRole>("conferente");
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(user.nome ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const lojasById = useMemo(() => Object.fromEntries(lojas.map((l) => [l.id, l])), [lojas]);
  const mercadosById = useMemo(
    () => Object.fromEntries(supermercados.map((s) => [s.id, s])),
    [supermercados],
  );
  const accessCount = globalRoles.length + lojaRoles.length;
  const duplicateLojaRole = lojaRoles.some((r) => r.loja_id === lojaId && r.role === role);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do usuário"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
              />
            </div>
          ) : (
            <>
              <div className="font-semibold">{user.nome ?? "Sem nome"}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
              {accessCount === 0 ? "Sem acesso" : `${accessCount} acessos`}
            </span>
            {globalRoles.map((r) => (
              <span
                key={r}
                className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary"
              >
                Global: {ROLE_LABEL[r]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onUpdateProfile(user.id, nome, email);
                  setEditing(false);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNome(user.nome ?? "");
                  setEmail(user.email ?? "");
                  setEditing(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                title="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
          <button
            type="button"
            onClick={() => onClearUserAccess(user.id)}
            disabled={accessCount === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-45"
          >
            <UserX className="h-3.5 w-3.5" />
            Suspender
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Papéis globais
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => {
              const has = globalRoles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onToggleGlobalRole(user.id, r, has)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    has
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Tipos de usuário por loja
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {lojaRoles.map((item) => {
              const loja = lojasById[item.loja_id];
              const mercado = loja ? mercadosById[loja.supermercado_id] : null;
              return (
                <div
                  key={item.id}
                  className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {mercado?.nome ?? "Supermercado"} / {loja?.nome ?? "Loja"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {ROLE_LABEL[item.role]}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveLojaRole(item.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                    title="Remover acesso"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {lojaRoles.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Sem acesso específico por loja.
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (duplicateLojaRole) return toast.error("Este acesso já existe para o usuário.");
              onAddLojaRole(user.id, lojaId, role);
              setLojaId("");
              setRole("conferente");
            }}
            className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_auto]"
          >
            <select
              value={lojaId}
              onChange={(e) => setLojaId(e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
            >
              <option value="">Selecionar loja</option>
              {lojas.map((l) => (
                <option key={l.id} value={l.id}>
                  {mercadosById[l.supermercado_id]?.nome ?? "Supermercado"} / {l.nome} ({l.tipo})
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!lojaId || duplicateLojaRole}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StoresPanel() {
  const qc = useQueryClient();
  const { supermercados, lojas, loading } = useAdminData();
  const [superNome, setSuperNome] = useState("");
  const [superCnpj, setSuperCnpj] = useState("");
  const [lojaForm, setLojaForm] = useState({
    supermercadoId: "",
    matrizId: "",
    nome: "",
    codigo: "",
    cnpj: "",
    tipo: "matriz",
    endereco: "",
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
  };

  const addSupermercado = async () => {
    const nome = superNome.trim();
    if (!nome) return toast.error("Informe o nome do supermercado.");
    const { error } = await supabase.from("supermercados").insert({
      nome,
      cnpj: superCnpj.trim() || null,
    });
    if (error) return toast.error(error.message);
    setSuperNome("");
    setSuperCnpj("");
    toast.success("Supermercado adicionado.");
    refresh();
  };

  const addLoja = async () => {
    if (!lojaForm.supermercadoId) return toast.error("Selecione um supermercado.");
    if (!lojaForm.nome.trim() || !lojaForm.codigo.trim()) {
      return toast.error("Informe nome e código da loja.");
    }
    const { error } = await supabase.from("lojas").insert({
      supermercado_id: lojaForm.supermercadoId,
      matriz_id: lojaForm.tipo === "filial" ? lojaForm.matrizId || null : null,
      nome: lojaForm.nome.trim(),
      codigo: lojaForm.codigo.trim(),
      cnpj: lojaForm.cnpj.trim() || null,
      tipo: lojaForm.tipo,
      endereco: lojaForm.endereco.trim() || null,
    });
    if (error) return toast.error(error.message);
    setLojaForm((current) => ({
      ...current,
      matrizId: "",
      nome: "",
      codigo: "",
      cnpj: "",
      endereco: "",
    }));
    toast.success("Loja adicionada.");
    refresh();
  };

  const removeLoja = async (id: string) => {
    const { error } = await supabase.from("lojas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const matrizes = lojas.filter(
    (l) => l.supermercado_id === lojaForm.supermercadoId && l.tipo === "matriz",
  );

  return (
    <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Adicionar supermercado</h2>
          </div>
          <div className="space-y-2">
            <input
              value={superNome}
              onChange={(e) => setSuperNome(e.target.value)}
              placeholder="Nome do supermercado"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
            />
            <input
              value={superCnpj}
              onChange={(e) => setSuperCnpj(e.target.value)}
              placeholder="CNPJ (opcional)"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={addSupermercado}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Adicionar matriz ou filial</h2>
          </div>
          <div className="space-y-2">
            <select
              value={lojaForm.supermercadoId}
              onChange={(e) =>
                setLojaForm((current) => ({
                  ...current,
                  supermercadoId: e.target.value,
                  matrizId: "",
                }))
              }
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
            >
              <option value="">Supermercado</option>
              {supermercados.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setLojaForm((current) => ({ ...current, tipo: "matriz", matrizId: "" }))
                }
                className={`h-10 rounded-xl border text-sm font-semibold ${
                  lojaForm.tipo === "matriz"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                Matriz
              </button>
              <button
                type="button"
                onClick={() => setLojaForm((current) => ({ ...current, tipo: "filial" }))}
                className={`h-10 rounded-xl border text-sm font-semibold ${
                  lojaForm.tipo === "filial"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                Filial
              </button>
            </div>
            {lojaForm.tipo === "filial" && (
              <select
                value={lojaForm.matrizId}
                onChange={(e) =>
                  setLojaForm((current) => ({ ...current, matrizId: e.target.value }))
                }
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
              >
                <option value="">Matriz vinculada</option>
                {matrizes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            )}
            <input
              value={lojaForm.nome}
              onChange={(e) => setLojaForm((current) => ({ ...current, nome: e.target.value }))}
              placeholder="Nome da loja"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={lojaForm.codigo}
                onChange={(e) => setLojaForm((current) => ({ ...current, codigo: e.target.value }))}
                placeholder="Código"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
              />
              <input
                value={lojaForm.cnpj}
                onChange={(e) => setLojaForm((current) => ({ ...current, cnpj: e.target.value }))}
                placeholder="CNPJ"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none"
              />
            </div>
            <input
              value={lojaForm.endereco}
              onChange={(e) => setLojaForm((current) => ({ ...current, endereco: e.target.value }))}
              placeholder="Endereço"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={addLoja}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar loja
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Supermercados cadastrados</h2>
        </div>
        {loading && (
          <div className="text-sm text-muted-foreground">Carregando supermercados...</div>
        )}
        {!loading && supermercados.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum supermercado cadastrado.
          </div>
        )}
        <div className="space-y-4">
          {supermercados.map((s) => {
            const lojasDoSuper = lojas.filter((l) => l.supermercado_id === s.id);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-background/35 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{s.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.cnpj ?? "CNPJ não informado"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{lojasDoSuper.length} lojas</div>
                </div>
                <div className="mt-3 grid gap-2">
                  {lojasDoSuper.map((l) => {
                    const matriz = lojas.find((item) => item.id === l.matriz_id);
                    return (
                      <div
                        key={l.id}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{l.nome}</span>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                              {l.tipo}
                            </span>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {l.codigo}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {l.tipo === "filial" && matriz
                              ? `Matriz: ${matriz.nome}`
                              : "Loja matriz"}
                            {l.endereco ? ` · ${l.endereco}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLoja(l.id)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      </div>
                    );
                  })}
                  {lojasDoSuper.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                      Adicione a matriz ou uma filial para este supermercado.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
