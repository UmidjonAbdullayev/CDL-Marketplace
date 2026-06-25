import { supabase } from "../lib/supabase";
import type { RegistrationAccount } from "../types/registration";
import {
  buildSessionAccount,
  fetchRegistrationByAuthUserId,
  fetchRegistrationByEmail,
  hashPassword
} from "./registration";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Invalid email or password";
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox or use Forgot password.";
  }
  if (lower.includes("user already registered")) return "An account with this email already exists. Sign in instead.";
  return message;
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<RegistrationAccount> {
  if (!supabase) throw new AuthError("Supabase not configured");

  const normalized = email.trim().toLowerCase();
  const existing = await fetchRegistrationByEmail(normalized);

  if (existing?.auth_user_id) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password
    });
    if (error) {
      const legacy = await tryLegacySignIn(normalized, password, false);
      if (legacy) return legacy;
      throw new AuthError(mapAuthError(error.message));
    }
    const account = await resolveAccountFromAuthUser(data.user?.id ?? null, normalized);
    assertAccountCanSignIn(account);
    return buildSessionAccount(account);
  }

  const legacy = await tryLegacySignIn(normalized, password, true);
  if (legacy) return legacy;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password
  });
  if (error) throw new AuthError(mapAuthError(error.message));

  const account = await resolveAccountFromAuthUser(data.user?.id ?? null, normalized);
  assertAccountCanSignIn(account);
  return buildSessionAccount(account);
}

async function tryLegacySignIn(
  email: string,
  password: string,
  allowMigrate: boolean
): Promise<RegistrationAccount | null> {
  if (!supabase) return null;

  const password_hash = await hashPassword(password);
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("*")
    .ilike("email", email)
    .eq("password_hash", password_hash)
    .maybeSingle();
  if (error || !data) return null;

  const account = data as RegistrationAccount;
  assertAccountCanSignIn(account);

  if (allowMigrate && !account.auth_user_id) {
    await migrateLegacyAccountToAuth(account, password);
    const refreshed = await fetchRegistrationByEmail(email);
    if (refreshed) return buildSessionAccount(refreshed);
  }

  return buildSessionAccount(account);
}

async function migrateLegacyAccountToAuth(account: RegistrationAccount, password: string): Promise<void> {
  if (!supabase || account.auth_user_id) return;

  const { data, error } = await supabase.auth.signUp({
    email: account.email,
    password,
    options: {
      data: {
        registration_account_id: account.id
      }
    }
  });

  const authUserId = data.user?.id;
  if (error && !authUserId) {
    if (error.message.toLowerCase().includes("already registered")) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: account.email,
        password
      });
      if (signInData.user?.id) {
        await linkAuthUser(account.id, signInData.user.id);
      }
    }
    return;
  }

  if (authUserId) {
    await linkAuthUser(account.id, authUserId);
  }
}

async function linkAuthUser(registrationAccountId: string, authUserId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("registration_accounts")
    .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
    .eq("id", registrationAccountId);
}

async function resolveAccountFromAuthUser(authUserId: string | null, email: string): Promise<RegistrationAccount> {
  if (authUserId) {
    const byAuth = await fetchRegistrationByAuthUserId(authUserId);
    if (byAuth) return byAuth;
  }
  const byEmail = await fetchRegistrationByEmail(email);
  if (byEmail) {
    if (authUserId && !byEmail.auth_user_id) {
      await linkAuthUser(byEmail.id, authUserId);
      const linked = await fetchRegistrationByAuthUserId(authUserId);
      if (linked) return linked;
    }
    return byEmail;
  }
  throw new AuthError("Platform account not found for this login");
}

function assertAccountCanSignIn(account: RegistrationAccount): void {
  if (account.suspended || account.status === "rejected") {
    throw new AuthError(account.status === "rejected" ? "Account was rejected" : "Account is suspended");
  }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  metadata?: Record<string, unknown>
): Promise<{ authUserId: string; sessionCreated: boolean }> {
  if (!supabase) throw new AuthError("Supabase not configured");

  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: {
      data: metadata ?? {}
    }
  });

  if (error) throw new AuthError(mapAuthError(error.message));
  if (!data.user?.id) throw new AuthError("Could not create auth user");

  return {
    authUserId: data.user.id,
    sessionCreated: Boolean(data.session)
  };
}

export async function signOutAuth(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  if (!supabase) throw new AuthError("Supabase not configured");
  const redirectTo = `${window.location.origin}/register?mode=login`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) throw new AuthError(mapAuthError(error.message));
}

export async function updateAuthPassword(newPassword: string): Promise<void> {
  if (!supabase) throw new AuthError("Supabase not configured");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new AuthError(mapAuthError(error.message));
}

export async function restoreSessionFromAuth(): Promise<RegistrationAccount | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

  try {
    const account = await resolveAccountFromAuthUser(data.session.user.id, data.session.user.email ?? "");
    assertAccountCanSignIn(account);
    return buildSessionAccount(account);
  } catch {
    await supabase.auth.signOut();
    return null;
  }
}
