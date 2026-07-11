/**
 * Anonymous browser ownership token.
 *
 * Until real auth is added, every browser gets a stable UUID stored in
 * localStorage. The token is sent on every Supabase request via the
 * `x-owner-token` header and matched against `owner_token` columns in RLS.
 *
 * Losing localStorage = losing access to your datasets. We surface this in
 * the UI when relevant.
 */
const STORAGE_KEY = "luminary.owner_token";

let cached: string | null = null;

export function getOwnerToken(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) {
      cached = existing;
      return existing;
    }
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    // Private mode or storage disabled — fall back to in-memory token.
    if (!cached) cached = crypto.randomUUID();
    return cached;
  }
}

export function resetOwnerToken(): string {
  cached = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  return getOwnerToken();
}
