import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/** Strip whitespace and optional surrounding quotes from .env values */
function normalizeEnv(value: string | undefined): string {
  if (value == null || typeof value !== "string") return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = normalizeEnv(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_KEY = normalizeEnv(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
);

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const supabaseConfigValid =
  SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0 && isValidHttpUrl(SUPABASE_URL);

/** Shown in the UI when env is missing so users don't only see "Failed to fetch" */
export const supabaseConfigHint =
  "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) to a .env file in the project root, then restart the dev server (npm run dev). Get both from Supabase → Project Settings → API.";

if (!supabaseConfigValid && import.meta.env.DEV) {
  console.error(
    "[Baawisan Bank] Supabase env missing or invalid.\n",
    supabaseConfigHint,
    "\nCurrent URL set:",
    Boolean(SUPABASE_URL),
    "key set:",
    Boolean(SUPABASE_KEY),
  );
}

/**
 * Use real URL/key when configured. Placeholder values avoid crashing on import;
 * calls fail fast with a clear error from formatSupabaseAuthError.
 */
export const supabase = createClient<Database>(
  supabaseConfigValid ? SUPABASE_URL : "https://invalid.supabase.co",
  supabaseConfigValid ? SUPABASE_KEY : "invalid-key",
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
