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
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  );
}

function formatFaceAuthError(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : fallback;
  if (msg.includes("NotAllowedError")) {
    return "Operacao cancelada ou tempo esgotado. Tente novamente e confirme no Face ID/Touch ID.";
  }
  if (msg.includes("InvalidStateError")) {
    return "Este dispositivo ja esta cadastrado para este usuario.";
  }
  if (msg.includes("SecurityError")) {
    return "Biometria exige HTTPS ou localhost. Abra o sistema em um endereco seguro.";
  }
  if (msg.includes("not supported") || msg.includes("not eligible")) {
    return "Este navegador ou dispositivo nao oferece biometria WebAuthn para este site.";
  }
  return msg;
}

export function useFaceEnroll() {
  const startFn = useServerFn(startFaceRegistration);
  const finishFn = useServerFn(finishFaceRegistration);
  const [busy, setBusy] = useState(false);

  const enroll = async (deviceName?: string) => {
    if (!isFaceAuthSupported()) {
      toast.error("Este dispositivo nao suporta autenticacao biometrica.");
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
      toast.error(formatFaceAuthError(err, "Falha no cadastro biometrico"));
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
      toast.error("Este dispositivo nao suporta autenticacao biometrica.");
      return false;
    }
    if (!email) {
      toast.error("Informe seu e-mail antes de usar a biometria.");
      return false;
    }
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const options = await startFn({ data: { email: normalizedEmail } });
      const response = await startAuthentication({ optionsJSON: options });
      const { otp } = await finishFn({ data: { email: normalizedEmail, response } });
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp,
        type: "email",
      });
      if (error) throw error;
      toast.success("Bem-vindo!");
      return true;
    } catch (err) {
      toast.error(formatFaceAuthError(err, "Falha na autenticacao biometrica"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { login, busy };
}
