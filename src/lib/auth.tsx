import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "conferente" | "supervisor" | "auditor";

export type Profile = {
  id: string;
  nome: string | null;
  email: string | null;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  lojas: string[];
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
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }, { data: lojaRows }] = await Promise.all([
      supabase.from("profiles").select("id,nome,email").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_lojas").select("loja").eq("user_id", uid),
    ]);
    setProfile((prof as Profile) ?? null);
    setRoles((roleRows ?? []).map((r) => r.role as AppRole));
    setLojas((lojaRows ?? []).map((r) => r.loja as string));
  };

  const clearUserData = () => {
    setProfile(null);
    setRoles([]);
    setLojas([]);
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
  }, [loading, session, profile, roles, lojas]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
