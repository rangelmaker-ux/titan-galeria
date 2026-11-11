import { NextRequest, NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { Readable } from "node:stream";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/server";
import { shareTokenCandidates } from "@/lib/share-link";
import { resolveGalleryDownload, directOriginalUrl, type DownloadableMedia } from "@/lib/gallery-download";
import { displayKey, displayWidth, publicObjectExists, publicPreviewUrl, storePhotoPreview } from "@/lib/r2";
import { driveFolderUrl, listDriveFolderChildren, setDriveLinkSharing } from "@/lib/drive";
import { getDriveAccount } from "@/lib/drive-account";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // só o .zip de reserva (proxy) pode demorar

/** Download direto pra galerias de entrega gratuita (allow_downloads =
 * true) — sem pedido/pagamento envolvido, só o token da galeria.
 *
 *   ?mediaId=<uuid>            → o original, baixado DIRETO do Drive do fotógrafo
 *   ?mediaId=<uuid>&inline=1   → versão redimensionada pra exibir na tela
 *   ?all=1                     → a pasta da galeria no Drive (o Google zipa)
 *
 * Os bytes dos originais não passam mais pelo nosso servidor: isso é o que
 * estourava a cota de transferência da hospedagem. Se o Drive recusar o
 * link público (ex: conta Workspace bloqueada), cai no proxy antigo, então
 * nenhuma galeria deixa de funcionar. */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const db = createServiceClient();

  const { data: galeria } = await db
    .from("galleries")
    .select("id, photographer_id, allow_downloads, watermark_previews, drive_folder_id")
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

  if (baixarTudo) return downloadAll(db, galeria);

  if (!mediaId) return NextResponse.json({ error: "informe mediaId ou all=1" }, { status: 400 });
  const { data: midia } = await db
    .from("media")
    .select("id, drive_file_id, r2_key_preview, r2_key_original")
    .eq("id", mediaId)
    .eq("gallery_id", galeria.id)
    .single();
  if (!midia) return NextResponse.json({ error: "arquivo não encontrado" }, { status: 404 });

  try {
    if (url.searchParams.get("inline") === "1") {
      return displayVersion(galeria.id, galeria.photographer_id, midia, Number(url.searchParams.get("w")) || 1600);
    }

    // Entrega gratuita nunca tem marca d'água: sempre o original.
    const direto = await directOriginalUrl(midia, galeria.photographer_id);
    if (direto) return NextResponse.redirect(direto);

    // Reserva: proxy antigo (o arquivo passa pelo servidor).
    const resolvido = await resolveGalleryDownload(midia, false, galeria.photographer_id);
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

/** Versão de exibição (sem marca d'água, mesmo que a prévia antiga tenha a
 * marca gravada). Gerada UMA vez por foto e largura, guardada no R2 (que
 * não cobra transferência) e daí em diante só redirecionamos pra lá. Antes,
 * cada visualização puxava o original inteiro do Drive pelo servidor. */
async function displayVersion(galleryId: string, photographerId: string, midia: DownloadableMedia, requestedWidth: number) {
  const w = displayWidth(requestedWidth);
  const key = displayKey(galleryId, midia.id, w);

  if (await publicObjectExists(key)) {
    const res = NextResponse.redirect(publicPreviewUrl(key));
    res.headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
    return res;
  }

  const resolvido = await resolveGalleryDownload(midia, false, photographerId);
  if (!resolvido) return NextResponse.json({ error: "arquivo indisponível" }, { status: 404 });
  const bruto = "url" in resolvido ? await (await fetch(resolvido.url)).arrayBuffer() : await new Response(resolvido.stream).arrayBuffer();
  const out = await sharp(Buffer.from(bruto)).rotate().resize({ width: w, height: w, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  await storePhotoPreview(key, new Uint8Array(out)).catch((e) => console.error("[exibicao] falha ao guardar no R2", key, e?.message));
  return new NextResponse(new Uint8Array(out), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=604800" },
  });
}

/** "Baixar todas": manda pra pasta da galeria no Drive do fotógrafo, onde o
 * próprio Google oferece o download da pasta inteira em .zip. Só cai no
 * .zip montado pelo servidor se a pasta não puder ser usada (galeria com
 * mídia antiga fora do Drive, ou Drive recusando o link público). */
async function downloadAll(
  db: ReturnType<typeof createServiceClient>,
  galeria: { id: string; photographer_id: string; drive_folder_id: string | null }
) {
  const { data: midias } = await db
    .from("media")
    .select("id, drive_file_id, r2_key_preview, r2_key_original")
    .eq("gallery_id", galeria.id)
    .order("position", { ascending: true });
  if (!midias?.length) return NextResponse.json({ error: "nenhuma foto disponível ainda" }, { status: 404 });

  const tudoNoDrive = midias.every((m) => !!m.drive_file_id);
  if (galeria.drive_folder_id && tudoNoDrive) {
    try {
      const account = await getDriveAccount(galeria.photographer_id);
      // Trava: só compartilha a pasta se ela for EXCLUSIVA desta galeria —
      // tudo que está dentro dela tem que ser mídia desta galeria. Se houver
      // qualquer outra coisa (subpasta, arquivo de outro trabalho, ou a
      // "pasta" ser a raiz/tag por algum dado antigo), não compartilha nada
      // e entrega pelo .zip do servidor. Permissão de pasta só desce pros
      // filhos; nunca sobe pra raiz "Titan Galeria" nem pras pastas de tag.
      const daGaleria = new Set(midias.map((m) => m.drive_file_id as string));
      const conteudo = await listDriveFolderChildren(account, galeria.drive_folder_id);
      const exclusiva = conteudo.length > 0 && conteudo.every((id) => daGaleria.has(id));
      if (exclusiva) {
        await setDriveLinkSharing(account, galeria.drive_folder_id, true);
        return NextResponse.redirect(driveFolderUrl(galeria.drive_folder_id));
      }
      console.warn("[download] pasta do Drive não é exclusiva da galeria; usando .zip pelo servidor", galeria.id);
    } catch (e: any) {
      console.error("[download] pasta do Drive indisponível; usando .zip pelo servidor", galeria.id, e?.message);
    }
  }
  return streamZip(galeria, midias as DownloadableMedia[]);
}

async function streamZip(galeria: { photographer_id: string }, midias: DownloadableMedia[]) {
  // Sem compressão: JPEG/vídeo não diminuem, e comprimir só gastava CPU.
  const archive = new ZipArchive({ zlib: { level: 0 } });
  archive.on("warning", () => {});
  archive.on("error", () => {});

  // Monta o zip em paralelo com a resposta já sendo enviada — o archiver
  // vai liberando bytes conforme cada arquivo é adicionado, sem precisar
  // esperar a galeria inteira terminar de baixar antes de começar a enviar.
  void (async () => {
    let i = 0;
    for (const midia of midias) {
      i++;
      try {
        const resolvido = await resolveGalleryDownload(midia, false, galeria.photographer_id);
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
