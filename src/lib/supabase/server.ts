import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Cliente Supabase pra usar em Server Components / Route Handlers,
 * autenticado como o usuário logado (respeita RLS). */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de um Server Component — ok ignorar, o middleware
            // já cuida de renovar a sessão.
          }
        },
      },
    }
  );
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Cliente com a service role key — ignora RLS. Só usar em rotas de
 * servidor (webhooks, páginas públicas de galeria/portfólio) e nunca
 * expor essa chave pro navegador. */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
