import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScanFace, Trash2, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listFaceCredentials,
  deleteFaceCredential,
} from "@/lib/webauthn.functions";
import { useFaceEnroll, isFaceAuthSupported } from "@/hooks/useFaceAuth";

type Cred = {
  id: string;
  device_name: string | null;
  created_at: string;
  last_used_at: string | null;
};

export function FaceIdCard() {
  const listFn = useServerFn(listFaceCredentials);
  const deleteFn = useServerFn(deleteFaceCredential);
  const { enroll, busy: enrolling } = useFaceEnroll();
  const [creds, setCreds] = useState<Cred[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const supported = typeof window !== "undefined" && isFaceAuthSupported();

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listFn();
      setCreds(rows as Cred[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar biometrias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEnroll = async () => {
    const ok = await enroll(deviceName.trim() || undefined);
    if (ok) {
      setDeviceName("");
      await refresh();
    }
  };

  const onDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFn({ data: { id } });
      toast.success("Biometria removida");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <ScanFace className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Login por biometria</h2>
            <p className="text-xs text-muted-foreground break-words">
              Use Face ID, Touch ID ou biometria do Android para entrar sem senha.
            </p>
          </div>
        </div>
        {creds.length > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400">
            <ShieldCheck className="h-3 w-3" /> Ativo
          </span>
        )}
      </div>

      {!supported ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          Seu dispositivo/navegador não suporta autenticação biométrica WebAuthn.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Nome do dispositivo (ex: iPhone do João)"
              className="h-10 flex-1 rounded-xl border border-border bg-background/50 px-3 text-sm outline-none focus:border-primary"
              maxLength={80}
            />
            <button
              type="button"
              onClick={onEnroll}
              disabled={enrolling}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {enrolling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Cadastrar biometria
            </button>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : creds.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-background/30 p-3 text-center text-xs text-muted-foreground">
                Nenhuma biometria cadastrada ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {creds.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {c.device_name ?? "Dispositivo"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Cadastrado {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        {c.last_used_at
                          ? ` • Último uso ${new Date(c.last_used_at).toLocaleDateString("pt-BR")}`
                          : " • Nunca utilizado"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      aria-label="Remover"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
