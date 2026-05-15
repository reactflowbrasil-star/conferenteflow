import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  startFaceRegistration,
  finishFaceRegistration,
  startFaceLogin,
  finishFaceLogin,
} from "@/lib/webauthn.functions";

export function isFaceAuthSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export function useFaceEnroll() {
  const startFn = useServerFn(startFaceRegistration);
  const finishFn = useServerFn(finishFaceRegistration);
  const [busy, setBusy] = useState(false);

  const enroll = async (deviceName?: string) => {
    if (!isFaceAuthSupported()) {
      toast.error("Este dispositivo não suporta autenticação biométrica.");
      return false;
    }
    setBusy(true);
    try {
      const options = await startFn();
      const response = await startRegistration({ optionsJSON: options });
      await finishFn({ data: { response, deviceName } });
      toast.success("Biometria cadastrada com sucesso!");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no cadastro biométrico";
      toast.error(msg);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { enroll, busy };
}

export function useFaceLogin() {
  const startFn = useServerFn(startFaceLogin);
  const finishFn = useServerFn(finishFaceLogin);
  const [busy, setBusy] = useState(false);

  const login = async (email: string) => {
    if (!isFaceAuthSupported()) {
      toast.error("Este dispositivo não suporta autenticação biométrica.");
      return false;
    }
    if (!email) {
      toast.error("Informe seu e-mail antes de usar a biometria.");
      return false;
    }
    setBusy(true);
    try {
      const options = await startFn({ data: { email } });
      const response = await startAuthentication({ optionsJSON: options });
      const { otp } = await finishFn({ data: { email, response } });
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) throw error;
      toast.success("Bem-vindo!");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na autenticação biométrica";
      toast.error(msg);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { login, busy };
}
