"use client";

import { useEffect, useState } from "react";

type Midia = {
  id: string;
  type: "photo" | "video";
  previewUrl: string;
};

type Produto = {
  id: string;
  type: "download_single" | "download_all" | "print";
  name: string;
  price_cents: number;
  currency: string;
  print_size: string | null;
};

type Props = {
  shareToken: string;
  title: string;
  clientName: string | null;
  allowFavorites: boolean;
  allowDownloads: boolean;
  midias: Midia[];
  produtos: Produto[];
  pedidoStatus?: string;
  orderId?: string;
};

function formatarPreco(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

export function ClientGalleryView({
  shareToken,
  title,
  clientName,
  allowFavorites,
  produtos,
  midias,
  pedidoStatus,
  orderId,
}: Props) {
  const [identificador, setIdentificador] = useState<string | null>(null);
  const [nomeInput, setNomeInput] = useState("");
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [linksDownload, setLinksDownload] = useState<{ mediaId: string; url: string }[] | null>(null);

  useEffect(() => {
    const salvo = localStorage.getItem(`titan_galeria_id_${shareToken}`);
    if (salvo) setIdentificador(salvo);
  }, [shareToken]);

  useEffect(() => {
    if (pedidoStatus === "sucesso" && orderId) {
      fetch(`/api/downloads/${orderId}`)
        .then((r) => r.json())
        .then((d) => d.links && setLinksDownload(d.links));
    }
  }, [pedidoStatus, orderId]);

  function salvarIdentificador(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(`titan_galeria_id_${shareToken}`, nomeInput);
    setIdentificador(nomeInput);
  }

  async function toggleFavorito(mediaId: string) {
    if (!identificador) return;
    const novoValor = !favoritos.has(mediaId);
    setFavoritos((prev) => {
      const next = new Set(prev);
      novoValor ? next.add(mediaId) : next.delete(mediaId);
      return next;
    });
    await fetch(`/api/galeria-publica/${shareToken}/selecionar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId, clientIdentifier: identificador, favorited: novoValor }),
    });
  }

  async function comprar(productId: string, mediaId?: string) {
    if (!identificador) return;
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shareToken,
        productId,
        mediaId,
        clientIdentifier: identificador,
      }),
    });
    const data = await res.json();
    if (data.checkoutUrl) window.location.href = data.checkoutUrl;
  }

  if (!identificador) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="mb-1 text-xl font-semibold">{title}</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Pra favoritar fotos ou fazer pedidos, diga seu nome.
        </p>
        <form onSubmit={salvarIdentificador} className="flex flex-col gap-3">
          <input
            required
            value={nomeInput}
            onChange={(e) => setNomeInput(e.target.value)}
            placeholder="Seu nome"
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm"
          />
          <button className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper">
            Ver galeria
          </button>
        </form>
      </main>
    );
  }

  const produtoDownloadAll = produtos.find((p) => p.type === "download_all");
  const produtoDownloadSingle = produtos.find((p) => p.type === "download_single");
  const produtosPrint = produtos.filter((p) => p.type === "print");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {clientName && <p className="text-sm text-neutral-500">{clientName}</p>}
        </div>
        {produtoDownloadAll && (
          <button
            onClick={() => comprar(produtoDownloadAll.id)}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper"
          >
            Comprar todas as fotos — {formatarPreco(produtoDownloadAll.price_cents, produtoDownloadAll.currency)}
          </button>
        )}
      </header>

      {linksDownload && (
        <div className="mb-8 rounded-xl border border-green-300 bg-green-50 p-4">
          <p className="mb-2 text-sm font-medium text-green-800">
            Pagamento confirmado! Seus downloads:
          </p>
          <div className="flex flex-wrap gap-2">
            {linksDownload.map((l) => (
              <a
                key={l.mediaId}
                href={l.url}
                className="rounded-lg bg-white px-3 py-1.5 text-xs underline"
              >
                baixar foto
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {midias.map((m) => (
          <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
            {m.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={m.previewUrl} className="h-full w-full object-cover" controls />
            )}

            {allowFavorites && (
              <button
                onClick={() => toggleFavorito(m.id)}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-sm text-white"
              >
                {favoritos.has(m.id) ? "♥" : "♡"}
              </button>
            )}

            {(produtoDownloadSingle || produtosPrint.length > 0) && (
              <div className="absolute inset-x-0 bottom-0 hidden flex-col gap-1 bg-black/70 p-2 group-hover:flex">
                {produtoDownloadSingle && (
                  <button
                    onClick={() => comprar(produtoDownloadSingle.id, m.id)}
                    className="rounded bg-white/90 px-2 py-1 text-xs"
                  >
                    Comprar — {formatarPreco(produtoDownloadSingle.price_cents, produtoDownloadSingle.currency)}
                  </button>
                )}
                {produtosPrint.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => comprar(p.id, m.id)}
                    className="rounded bg-white/90 px-2 py-1 text-xs"
                  >
                    Print {p.print_size} — {formatarPreco(p.price_cents, p.currency)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
