import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RP_NAME = "ConferFlow";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function getRequestOrigin(): string {
  const origin = getRequestHeader("origin");
  if (origin) return origin;

  const ref = getRequestHeader("referer");
  if (ref) {
    try {
      return new URL(ref).origin;
    } catch {
      /* ignore */
    }
  }

  return "http://localhost";
}

function getRpId(): string {
  const host = new URL(getRequestOrigin()).hostname;
  return host || "localhost";
}

function getExpectedOrigins(): string[] {
  const origin = getRequestOrigin();
  const url = new URL(origin);
  const origins = new Set([origin]);

  if (url.hostname === "localhost") {
    origins.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`);
  }
  if (url.hostname === "127.0.0.1") {
    origins.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`);
  }

  return Array.from(origins);
}

function challengeExpiresAt() {
  return new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
}

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function toTransports(value: string[] | null | undefined) {
  return (value ?? undefined) as AuthenticatorTransport[] | undefined;
}

const responseSchema = z.custom<RegistrationResponseJSON | AuthenticationResponseJSON>(
  (value) => Boolean(value && typeof value === "object" && "id" in value && "response" in value),
  "Resposta biometrica invalida.",
);

export const startFaceRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const email =
      String(claims.email ?? "")
        .trim()
        .toLowerCase() || "usuario@conferflow.local";
    const rpID = getRpId();

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: email,
      userDisplayName: email,
      timeout: CHALLENGE_TTL_MS,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
      },
    });

    const { error: deleteError } = await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", userId)
      .eq("type", "registration");
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: userId,
      challenge: options.challenge,
      type: "registration",
      expires_at: challengeExpiresAt(),
    });
    if (insertError) throw new Error(insertError.message);

    return options;
  });

export const finishFaceRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        response: responseSchema,
        deviceName: z.string().trim().min(1).max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const rpID = getRpId();

    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge, expires_at")
      .eq("user_id", userId)
      .eq("type", "registration")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (challengeError) throw new Error(challengeError.message);
    if (!challenge) throw new Error("Desafio nao encontrado. Reinicie o cadastro.");
    if (isExpired(challenge.expires_at)) throw new Error("Desafio expirado. Reinicie o cadastro.");

    const verification = await verifyRegistrationResponse({
      response: data.response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Falha ao verificar a credencial biometrica.");
    }

    const { credential } = verification.registrationInfo;

    const { error: insertError } = await supabaseAdmin.from("webauthn_credentials").insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      device_name: data.deviceName ?? "Dispositivo biometrico",
    });
    if (insertError) {
      if (insertError.code === "23505") {
        throw new Error("Este dispositivo ja esta cadastrado.");
      }
      throw new Error(insertError.message);
    }

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", userId)
      .eq("type", "registration");

    return { verified: true };
  });

export const startFaceLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: z.string().trim().email() }).parse(input))
  .handler(async ({ data }) => {
    const rpID = getRpId();
    const email = data.email.trim().toLowerCase();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Nenhuma biometria cadastrada para este e-mail.");

    const { data: credentials, error: credentialsError } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", profile.id);
    if (credentialsError) throw new Error(credentialsError.message);
    if (!credentials || credentials.length === 0) {
      throw new Error("Nenhuma biometria cadastrada para este e-mail.");
    }

    const options = await generateAuthenticationOptions({
      rpID,
      timeout: CHALLENGE_TTL_MS,
      userVerification: "required",
      allowCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: toTransports(credential.transports),
      })),
    });

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("email", email)
      .eq("type", "authentication");

    const { error: insertError } = await supabaseAdmin.from("webauthn_challenges").insert({
      email,
      user_id: profile.id,
      challenge: options.challenge,
      type: "authentication",
      expires_at: challengeExpiresAt(),
    });
    if (insertError) throw new Error(insertError.message);

    return options;
  });

export const finishFaceLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        response: responseSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const rpID = getRpId();
    const email = data.email.trim().toLowerCase();
    const response = data.response as AuthenticationResponseJSON;

    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge, expires_at, user_id")
      .eq("email", email)
      .eq("type", "authentication")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (challengeError) throw new Error(challengeError.message);
    if (!challenge || !challenge.user_id) throw new Error("Desafio nao encontrado.");
    if (isExpired(challenge.expires_at)) throw new Error("Desafio expirado. Tente novamente.");

    const { data: credential, error: credentialError } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("credential_id, public_key, counter, transports")
      .eq("credential_id", response.id)
      .eq("user_id", challenge.user_id)
      .maybeSingle();
    if (credentialError) throw new Error(credentialError.message);
    if (!credential) throw new Error("Credencial biometrica nao reconhecida.");

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: getExpectedOrigins(),
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credential.credential_id,
        publicKey: new Uint8Array(Buffer.from(credential.public_key, "base64")),
        counter: Number(credential.counter),
        transports: toTransports(credential.transports),
      },
    });

    if (!verification.verified) throw new Error("Verificacao biometrica falhou.");

    const { error: updateError } = await supabaseAdmin
      .from("webauthn_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("credential_id", response.id);
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("email", email)
      .eq("type", "authentication");

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link?.properties?.email_otp) {
      throw new Error("Nao foi possivel emitir sessao. Tente novamente.");
    }

    return { email, otp: link.properties.email_otp };
  });

export const listFaceCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteFaceCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("webauthn_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
