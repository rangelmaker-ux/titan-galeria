import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Espelha a logo pública do R2 pela mesma origem do site. O canvas que
 * marca as fotos no navegador (upload-client.ts) precisa ler essa imagem
 * via <img> + drawImage; se viesse direto do domínio do R2 e o bucket não
 * mandasse cabeçalho CORS, o canvas ficaria "contaminado" e o navegador
 * bloquearia a exportação da prévia. Restringe ao prefixo "marcas/" do
 * nosso próprio bucket público pra não virar um proxy aberto. */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!u || !base || !u.startsWith(`${base}/marcas/`)) {
    return NextResponse.json({ error: "url inválida" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(u);
  } catch {
    return NextResponse.json({ error: "não foi possível buscar a logo" }, { status: 502 });
  }
  if (!res.ok || !res.body) return NextResponse.json({ error: "logo não encontrada" }, { status: 404 });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
