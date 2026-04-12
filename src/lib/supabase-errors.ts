import { supabaseConfigHint, supabaseConfigValid } from "@/integrations/supabase/client";

function readAuthErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const c = (error as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

/** User-facing text for sign-in / sign-up failures */
export function formatSupabaseAuthError(error: unknown): string {
  if (!supabaseConfigValid) {
    return supabaseConfigHint;
  }

  const code = readAuthErrorCode(error);

  if (code === "over_email_send_rate_limit") {
    return [
      "Supabase limits confirmation emails per hour for hosted projects.",
      "Wait and retry, or disable “Confirm email” under Authentication → Providers → Email while developing (no email sent on sign-up).",
      "For production, configure custom SMTP in Project Settings → Authentication.",
    ].join(" ");
  }

  if (code === "over_request_rate_limit") {
    return "Too many auth requests from this browser or network. Wait a minute, then try again.";
  }

  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message: unknown }).message);
    const lower = msg.toLowerCase();

    if (
      lower.includes("email rate limit") ||
      lower.includes("rate limit exceeded") ||
      lower.includes("over_email_send")
    ) {
      return formatSupabaseAuthError({ code: "over_email_send_rate_limit" });
    }

    if (
      msg === "Failed to fetch" ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      lower.includes("network request failed")
    ) {
      return [
        "The app could not reach Supabase (network or DNS).",
        "Check: internet connection, ad-blockers, VPN, and that your Supabase project is not paused.",
        "Verify VITE_SUPABASE_URL matches Project Settings → API, then restart npm run dev.",
      ].join(" ");
    }

    return msg;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
