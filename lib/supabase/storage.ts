import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_PROJECTS_STORAGE_BUCKET = "project-images";

function dataUrlToBlob(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!m) throw new Error("지원하지 않는 data URL 형식입니다.");
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadDataUrlAsJpegPublic(
  supabase: SupabaseClient,
  opts: {
    bucket: string;
    path: string;
    dataUrl: string;
  },
) {
  const { bucket, path, dataUrl } = opts;
  if (!dataUrl.startsWith("data:")) {
    throw new Error("uploadDataUrlAsJpegPublic은 data URL만 지원합니다.");
  }

  const blob = dataUrlToBlob(dataUrl);
  await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: true,
  });

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data
    .publicUrl;
  return publicUrl;
}

