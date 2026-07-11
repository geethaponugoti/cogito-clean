import { createClient } from "@supabase/supabase-js";
import { getOwnerToken } from "@/lib/ownerToken";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const ownedSupabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { "x-owner-token": getOwnerToken() } },
});

export function ownerHeaders(extra: Record<string, string> = {}) {
  return { ...extra, "x-owner-token": getOwnerToken() };
}