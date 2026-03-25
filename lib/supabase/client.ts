import { createClient } from "@supabase/supabase-js";

let instance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  instance = createClient(url, anonKey);
  return instance;
}

// 기존 코드 호환용: 많은 곳에서 supabaseClient()를 사용 중입니다.
export function supabaseClient() {
  return getSupabaseClient();
}

