const SUPABASE_URL_FALLBACK = "https://kkcnvajdwvdukdbzafdx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY_FALLBACK =
  "sb_publishable_M9kDVIJHzbp9omXlhYBftg_DgUJ3OT6";

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL_FALLBACK;
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    SUPABASE_PUBLISHABLE_KEY_FALLBACK
  );
}

export function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
