import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RP_NAME = "ConferFlow";

function getRpId(): string {
  const origin = getRequestHeader("origin") ?? getRequestHeader("referer") ?? "";
  try {
    const host = new URL(origin).hostname;
    return host || "localhost";
  } catch {
    return "localhost";
  }
}

function getOrigin(): string {
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

// === Registration: generate options (authenticated) ===
export const startFaceRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const email = (claims.email as string) ?? "user";
    const rpID = getRpId();

    // Existing creds to exclude
    const { data: existing } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", userId);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: email,
      userDisplayName: email,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      })),
    });

    // Store challenge (clear previous registration challenges for this user)
    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", userId)
      .eq("type", "registration");
    await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: userId,
      challenge: options.challenge,
      type: "registration",
    });

    return options;
  });

// === Registration: verify (authenticated) ===
export const finishFaceRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        response: z.any(),
        deviceName: z.string().min(1).max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const rpID = getRpId();
    const origin = getOrigin();

    // Pull challenge
    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge, expires_at")
      .eq("user_id", userId)
      .eq("type", "registration")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ch) throw new Error("Desafio não encontrado. Reinicie o cadastro.");
    if (new Date(ch.expires_at).getTime() < Date.now()) {
      throw new Error("Desafio expirado. Reinicie o cadastro.");
    }

    const verification = await verifyRegistrationResponse({
      response: data.response as RegistrationResponseJSON,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Falha ao verificar a credencial biométrica.");
    }

    const { credential } = verification.registrationInfo;

    const { error } = await supabaseAdmin.from("webauthn_credentials").insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      device_name: data.deviceName ?? "Dispositivo biométrico",
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("user_id", userId)
      .eq("type", "registration");

    return { verified: true };
  });

// === Authentication: generate options (public) ===
export const startFaceLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email() }).parse(input),
  )
  .handler(async ({ data }) => {
    const rpID = getRpId();
    const email = data.email.trim().toLowerCase();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!profile) {
      // Don't leak existence; still return valid options with no allowCredentials
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: [],
      });
      return options;
    }

    const { data: creds } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", profile.id);

    if (!creds || creds.length === 0) {
      throw new Error("Nenhuma credencial biométrica cadastrada para este e-mail.");
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: (c.transports ?? undefined) as AuthenticatorTransport[] | undefined,
      })),
    });

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("email", email)
      .eq("type", "authentication");
    await supabaseAdmin.from("webauthn_challenges").insert({
      email,
      user_id: profile.id,
      challenge: options.challenge,
      type: "authentication",
    });

    return options;
  });

// === Authentication: verify (public) — returns email OTP for client signin ===
export const finishFaceLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        response: z.any(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const rpID = getRpId();
    const origin = getOrigin();
    const email = data.email.trim().toLowerCase();

    const { data: ch } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("challenge, expires_at, user_id")
      .eq("email", email)
      .eq("type", "authentication")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ch || !ch.user_id) throw new Error("Desafio não encontrado.");
    if (new Date(ch.expires_at).getTime() < Date.now()) {
      throw new Error("Desafio expirado. Tente novamente.");
    }

    const response = data.response as AuthenticationResponseJSON;

    const { data: cred } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("credential_id, public_key, counter, transports")
      .eq("credential_id", response.id)
      .eq("user_id", ch.user_id)
      .maybeSingle();
    if (!cred) throw new Error("Credencial biométrica não reconhecida.");

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64")),
        counter: Number(cred.counter),
        transports: (cred.transports ?? undefined) as
          | AuthenticatorTransport[]
          | undefined,
      },
    });

    if (!verification.verified) {
      throw new Error("Verificação biométrica falhou.");
    }

    // Update counter & last_used
    await supabaseAdmin
      .from("webauthn_credentials")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("credential_id", response.id);

    await supabaseAdmin
      .from("webauthn_challenges")
      .delete()
      .eq("email", email)
      .eq("type", "authentication");

    // Issue an email OTP that the client can immediately verify to create a session
    const { data: link, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    if (linkErr || !link?.properties?.email_otp) {
      throw new Error("Não foi possível emitir sessão. Tente novamente.");
    }

    return { email, otp: link.properties.email_otp };
  });

// === List user's credentials (authenticated) ===
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

// === Delete a credential (authenticated) ===
export const deleteFaceCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("webauthn_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
