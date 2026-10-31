import { NextRequest, NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { Readable } from "node:stream";
import { createServiceClient } from "@/lib/supabase/server";
import { shareTokenCandidates } from "@/lib/share-link";
import { resolveGalleryDownload, type DownloadableMedia } from "@/lib/gallery-download";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // galerias grandes em .zip podem demorar

/** Download direto pra galerias de entrega gratuita (allow_downloads =
 * true) — sem pedido/pagamento envolvido, só o token da galeria. Suporta
 * ?mediaId=<uuid> pra uma foto só, ou ?all=1 pra um .zip com tudo que já
 * está disponível. Segue a mesma regra de marca d'água do download de
 * pedidos pagos: ver src/lib/gallery-download.ts. */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const db = createServiceClient();

  const { data: galeria } = await db
    .from("galleries")
    .select("id, photographer_id, allow_downloads, watermark_previews")
    .in("share_token", shareTokenCandidates(params.token))
    .is("deleted_at", null)
    .single();
  if (!galeria) return NextResponse.json({ error: "galeria não encontrada" }, { status: 404 });
  if (!galeria.allow_downloads) {
    return NextResponse.json({ error: "download direto não está liberado nesta galeria" }, { status: 403 });
  }

  const url = new URL(req.url);
  const baixarTudo = url.searchParams.get("all") === "1";
  const mediaId = url.searchParams.get("mediaId");

  if (baixarTudo) return streamZip(db, galeria);

  if (!mediaId) return NextResponse.json({ error: "informe mediaId ou all=1" }, { status: 400 });
  const { data: midia } = await db
    .from("media")
    .select("id, drive_file_id, r2_key_preview, r2_key_original")
    .eq("id", mediaId)
    .eq("gallery_id", galeria.id)
    .single();
  if (!midia) return NextResponse.json({ error: "arquivo não encontrado" }, { status: 404 });

  try {
    const resolvido = await resolveGalleryDownload(midia, galeria.watermark_previews, galeria.photographer_id);
    if (!resolvido) return NextResponse.json({ error: "arquivo indisponível" }, { status: 404 });
    if ("url" in resolvido) return NextResponse.redirect(resolvido.url);
    return new NextResponse(resolvido.stream, {
      headers: {
        "Content-Type": resolvido.mimeType,
        "Content-Disposition": `attachment; filename="${resolvido.fileName.replace(/"/g, "")}"`,
        ...(resolvido.size ? { "Content-Length": resolvido.size } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "falha ao buscar o arquivo" }, { status: 502 });
  }
}

async function streamZip(
  db: ReturnType<typeof createServiceClient>,
  galeria: { id: string; photographer_id: string; watermark_previews: boolean }
) {
  const { data: midias } = await db
    .from("media")
    .select("id, drive_file_id, r2_key_preview, r2_key_original")
    .eq("gallery_id", galeria.id)
    .order("position", { ascending: true });
  if (!midias?.length) return NextResponse.json({ error: "nenhuma foto disponível ainda" }, { status: 404 });

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("warning", () => {});
  archive.on("error", () => {});

  // Monta o zip em paralelo com a resposta já sendo enviada — o archiver
  // vai liberando bytes conforme cada arquivo é adicionado, sem precisar
  // esperar a galeria inteira terminar de baixar antes de começar a enviar.
  void (async () => {
    let i = 0;
    for (const midia of midias as DownloadableMedia[]) {
      i++;
      try {
        const resolvido = await resolveGalleryDownload(midia, galeria.watermark_previews, galeria.photographer_id);
        if (!resolvido) continue;
        const nome = `foto-${String(i).padStart(3, "0")}${"fileName" in resolvido ? extensaoDe(resolvido.fileName) : ".jpg"}`;
        if ("url" in resolvido) {
          const res = await fetch(resolvido.url);
          if (!res.ok || !res.body) continue;
          archive.append(Readable.fromWeb(res.body as any), { name: nome });
        } else {
          archive.append(Readable.fromWeb(resolvido.stream as any), { name: resolvido.fileName || nome });
        }
      } catch {
        // uma foto com falha não deve travar o zip inteiro — ela só fica de fora.
      }
    }
    await archive.finalize();
  })();

  return new NextResponse(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="galeria.zip"`,
    },
  });
}

function extensaoDe(fileName: string): string {
  const m = /\.[a-zA-Z0-9]+$/.exec(fileName);
  return m ? m[0] : ".jpg";
}
