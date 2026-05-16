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

export function getFaceAuthUnavailableReason(): string | null {
  if (typeof window === "undefined") return "Biometria disponivel apenas no navegador.";
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const permissionsPolicyReason = getWebAuthnPermissionsPolicyReason();

  if (!window.isSecureContext && !isLocalHost) {
    return "Abra o sistema em HTTPS. Em celular, HTTP por IP de rede bloqueia Face ID, Touch ID e Windows Hello.";
  }
  if (permissionsPolicyReason) return permissionsPolicyReason;
  if (typeof window.PublicKeyCredential === "undefined") {
    return "Este navegador nao oferece WebAuthn/passkeys.";
  }
  if (
    typeof navigator.credentials?.create !== "function" ||
    typeof navigator.credentials?.get !== "function"
  ) {
    return "Este navegador nao permite criar ou usar credenciais biometricas.";
  }
  return null;
}

export function isEmbeddedAccess(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function getWebAuthnPermissionsPolicyReason(): string | null {
  if (typeof document === "undefined") return null;
  const policyDocument = document as Document & {
    permissionsPolicy?: { allowsFeature?: (feature: string) => boolean };
    featurePolicy?: { allowsFeature?: (feature: string) => boolean };
  };
  const allowsFeature =
    policyDocument.permissionsPolicy?.allowsFeature?.bind(policyDocument.permissionsPolicy) ??
    policyDocument.featurePolicy?.allowsFeature?.bind(policyDocument.featurePolicy);

  if (allowsFeature) {
    try {
      const canCreate = allowsFeature("publickey-credentials-create");
      const canGet = allowsFeature("publickey-credentials-get");
      if (!canCreate || !canGet) {
        return "A biometria esta bloqueada neste preview. Abra o app em tela cheia ou em uma nova aba para cadastrar e entrar com Face ID/Touch ID.";
      }
    } catch {
      return null;
    }
  }

  if (isEmbeddedAccess()) {
    return "A biometria pode ser bloqueada dentro do preview. Abra o app em tela cheia ou em uma nova aba para cadastrar e entrar com Face ID/Touch ID.";
  }
  return null;
}

export function isFaceAuthSupported(): boolean {
  return getFaceAuthUnavailableReason() === null;
}

async function hasPlatformAuthenticator() {
  if (typeof window === "undefined" || typeof window.PublicKeyCredential === "undefined") {
    return false;
  }
  const checker = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
  if (typeof checker !== "function") return true;
  try {
    return await checker.call(window.PublicKeyCredential);
  } catch {
    return true;
  }
}

function formatFaceAuthError(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : fallback;
  if (
    msg.includes("publickey-credentials-create") ||
    msg.includes("publickey-credentials-get") ||
    msg.includes("Permissions Policy")
  ) {
    return "A biometria esta bloqueada neste preview. Abra o app em tela cheia ou em uma nova aba e tente novamente.";
  }
  if (msg.includes("NotAllowedError")) {
    return "O navegador cancelou a biometria. Tente novamente, confirme no Face ID/Touch ID/Windows Hello e remova cadastros antigos se este dispositivo ja estiver salvo.";
  }
  if (msg.includes("InvalidStateError")) {
    return "Este dispositivo ja esta cadastrado para este usuario.";
  }
  if (msg.includes("SecurityError")) {
    return "Biometria exige HTTPS ou localhost. Abra o sistema em um endereco seguro.";
  }
  if (msg.includes("HTTPS") || msg.includes("WebAuthn/passkeys")) {
    return msg;
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
    const unavailableReason = getFaceAuthUnavailableReason();
    if (unavailableReason) {
      toast.error(unavailableReason);
      return false;
    }
    if (!(await hasPlatformAuthenticator())) {
      toast.error("Nenhum Face ID, Touch ID, Windows Hello ou biometria Android foi encontrado.");
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
    const unavailableReason = getFaceAuthUnavailableReason();
    if (unavailableReason) {
      toast.error(unavailableReason);
      return false;
    }
    if (!(await hasPlatformAuthenticator())) {
      toast.error("Nenhum Face ID, Touch ID, Windows Hello ou biometria Android foi encontrado.");
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
      let verifyError: Error | null = null;
      for (const type of ["magiclink", "email"] as const) {
        const { error } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: otp,
          type,
        });
        if (!error) {
          verifyError = null;
          break;
        }
        verifyError = error;
      }
      if (verifyError) throw verifyError;
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
