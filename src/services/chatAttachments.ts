import { supabase } from "../lib/supabase";

const BUCKET = "chat-attachments";

export type UploadedAttachment = {
  path: string;
  name: string;
};

export async function uploadChatAttachment(file: File, folder: string): Promise<UploadedAttachment> {
  if (!supabase) throw new Error("Storage unavailable");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined
  });
  if (error) throw error;
  return { path, name: file.name };
}

/** Public bucket URL — works for all conversation participants without signing. */
export function getAttachmentViewUrl(path: string): string | null {
  if (!supabase || !path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

/** Fallback: stream file via Storage API (uses SELECT policy). */
export async function openAttachment(path: string, fileName: string): Promise<void> {
  if (!supabase) throw new Error("Storage unavailable");
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error;

  const blobUrl = URL.createObjectURL(data);
  const isPreviewable = /\.(jpe?g|png|gif|webp|pdf)$/i.test(fileName);

  if (isPreviewable) {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  } else {
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fileName;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
}

export async function enrichMessagesWithAttachmentUrls<
  T extends { attachment_path?: string | null }
>(messages: T[]): Promise<(T & { attachment_url: string | null })[]> {
  return messages.map((m) => ({
    ...m,
    attachment_url: m.attachment_path ? getAttachmentViewUrl(m.attachment_path) : null
  }));
}
