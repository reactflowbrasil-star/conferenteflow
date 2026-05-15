import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "conferente" | "supervisor" | "auditor";

export type Profile = {
  id: string;
  nome: string | null;
  email: string | null;
};

export type LojaRole = {
  lojaId: string;
  loja: string;
  codigo: string;
  role: AppRole;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  lojas: string[];
  lojaRoles: LojaRole[];
  isAuditor: boolean;
  isSupervisor: boolean;
  isConferente: boolean;
  hasRole: (r: AppRole) => boolean;
  hasLojaAccess: (loja: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [lojas, setLojas] = useState<string[]>([]);
  const [lojaRoles, setLojaRoles] = useState<LojaRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }, { data: lojaRows }, { data: lojaRoleRows }] =
      await Promise.all([
        supabase.from("profiles").select("id,nome,email").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("user_lojas").select("loja").eq("user_id", uid),
        supabase.from("user_loja_roles").select("role, lojas(id,nome,codigo)").eq("user_id", uid),
      ]);
    const structuredLojaRoles = (lojaRoleRows ?? [])
      .map((r) => {
        const loja = Array.isArray(r.lojas) ? r.lojas[0] : r.lojas;
        if (!loja) return null;
        return {
          lojaId: loja.id as string,
          loja: loja.nome as string,
          codigo: loja.codigo as string,
          role: r.role as AppRole,
        };
      })
      .filter((r): r is LojaRole => Boolean(r));
    const nextRoles = Array.from(
      new Set([
        ...(roleRows ?? []).map((r) => r.role as AppRole),
        ...structuredLojaRoles.map((r) => r.role),
      ]),
    );
    const nextLojas = Array.from(
      new Set([
        ...(lojaRows ?? []).map((r) => r.loja as string),
        ...structuredLojaRoles.flatMap((r) => [r.loja, r.codigo]),
      ]),
    );
    setProfile((prof as Profile) ?? null);
    setRoles(nextRoles);
    setLojas(nextLojas);
    setLojaRoles(structuredLojaRoles);
  };

  const clearUserData = () => {
    setProfile(null);
    setRoles([]);
    setLojas([]);
    setLojaRoles([]);
  };

  useEffect(() => {
    // 1. Listener primeiro
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadUserData(newSession.user.id), 0);
      } else {
        clearUserData();
      }
    });

    // 2. Pega sessão existente
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadUserData(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAuditor = roles.includes("auditor");
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      lojas,
      lojaRoles,
      isAuditor,
      isSupervisor: roles.includes("supervisor"),
      isConferente: roles.includes("conferente"),
      hasRole: (r) => roles.includes(r),
      hasLojaAccess: (loja) => isAuditor || lojas.includes(loja),
      refresh: async () => {
        if (session?.user) await loadUserData(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [loading, session, profile, roles, lojas, lojaRoles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
