import { supabase } from "../lib/supabase";
import { getAttachmentViewUrl, uploadChatAttachment } from "./chatAttachments";

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
};

function adminNameFromProfile(profile: Record<string, string | undefined>, email: string): string {
  return profile.agencyName ?? profile.fullName ?? profile.companyName ?? email;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarUrlFromProfileData(profileData: unknown): string | null {
  const path = (profileData as { avatarPath?: string } | null)?.avatarPath;
  return path ? getAttachmentViewUrl(path) : null;
}

export async function fetchAdminProfile(adminId: string): Promise<AdminProfile | null> {
  if (!supabase || !adminId) return null;
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("id, email, profile_data")
    .eq("id", adminId)
    .maybeSingle();
  if (error || !data) return null;
  const profile = data.profile_data as Record<string, string | undefined>;
  const name = adminNameFromProfile(profile, data.email);
  return {
    id: data.id,
    name,
    email: data.email,
    initials: initialsFromName(name),
    avatarUrl: avatarUrlFromProfileData(profile)
  };
}

export async function uploadAdminAvatar(accountId: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const uploaded = await uploadChatAttachment(file, `profiles/${accountId}`);
  const { data: row, error: fetchErr } = await supabase
    .from("registration_accounts")
    .select("profile_data")
    .eq("id", accountId)
    .single();
  if (fetchErr || !row) throw fetchErr ?? new Error("Account not found");

  const profile = { ...(row.profile_data as object), avatarPath: uploaded.path };
  const { error } = await supabase
    .from("registration_accounts")
    .update({ profile_data: profile, updated_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) throw error;

  const url = getAttachmentViewUrl(uploaded.path);
  if (!url) throw new Error("Failed to resolve avatar URL");
  return url;
}
