import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase pra usar em Client Components (navegador). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
