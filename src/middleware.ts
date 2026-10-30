import { accountAccess, ACCESS_COLUMNS } from "@/lib/access";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Renova a sessão do Supabase a cada requisição e protege /painel/*.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/painel")) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data, error } = await supabase.from("photographers").select(ACCESS_COLUMNS).eq("id", user.id).single();
    const state = accountAccess(data);
    const path = request.nextUrl.pathname;
    const billing = path === "/painel/assinatura" || path === "/painel/teste";
    if (error && path.startsWith("/api/")) return NextResponse.json({ error: "Não foi possível conferir seu acesso. Tente novamente." }, { status: 503 });
    if (state === "welcome" || state === "expired") {
      if (path.startsWith("/api/")) return NextResponse.json({ error: state === "welcome" ? "Inicie seu teste de três dias no painel." : "Seu teste terminou. Assine para continuar usando as ferramentas.", code: "access_required", url: "/painel/assinatura" }, { status: 403 });
      if (!billing) {
        const url = request.nextUrl.clone(); url.pathname = state === "welcome" ? "/painel/teste" : "/painel/assinatura";
        const redirect = NextResponse.redirect(url);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    }
  }
  return response;
}

export const config = {
  matcher: ["/painel/:path*", "/api/galerias/:path*", "/api/upload/:path*", "/api/produtos", "/api/perfil", "/api/recebimentos", "/api/pedidos/:path*", "/api/drive/:path*", "/api/watermark-logo", "/api/admin/:path*"],
};
