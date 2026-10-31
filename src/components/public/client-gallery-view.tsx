"use client";
import { GalleryCover } from "./gallery-cover";
import { WelcomeIntro } from "./welcome-intro";
import { type CoverDesign } from "@/lib/gallery-cover";
import { parseWelcomeMessage, hasWelcomeMessage, type WelcomeMessage } from "@/lib/welcome-message";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LAYOUT_GRID, LAYOUT_ITEM, type GalleryTemplate } from "@/lib/gallery-layout";

type Midia = { id: string; type: "photo" | "video"; previewUrl: string };
type Produto = { id: string; type: "download_single" | "download_all" | "print"; name: string; price_cents: number; currency: string; print_size: string | null };
type Props = { cover?: Partial<CoverDesign> | null; welcomeMessage?: Partial<WelcomeMessage> | null; requireClientName?: boolean; photographerName?: string; shareToken: string; title: string; clientName: string | null; allowFavorites: boolean; allowDownloads: boolean; midias: Midia[]; produtos: Produto[]; pedidoStatus?: string; orderId?: string; marcaTitan?: boolean; template?: GalleryTemplate; aoVivo?: boolean; isPortfolio?: boolean; likeCounts?: Record<string, number> };
type Order = { status: string; clientName?: string; totalCents: number; pixKey: string; pixPayload?: string | null; pixQrDataUrl?: string | null; merchantName?: string | null; merchantAvatarUrl?: string | null; whatsappUrl: string | null; items?: { media_id: string; product_name: string; product_type: string }[]; links: { mediaId: string; url: string }[] };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const fullName = (name: string) => name.trim().split(/\s+/).length >= 2 && name.trim().length >= 3;
function Brand({ show }: { show?: boolean }) { return show ? <p className="mt-8 pb-6 text-center text-xs text-neutral-400">Feito com <a href="/" className="underline">Titan Galeria</a></p> : null; }
function Live({ enabled }: { enabled?: boolean }) { return enabled ? <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600"/>AO VIVO</span> : null; }

export function ClientGalleryView({ cover, welcomeMessage: welcomeMessageRaw, requireClientName = true, photographerName, shareToken, title, clientName, allowFavorites, allowDownloads, produtos, midias, orderId: initialOrderId, marcaTitan, template = "grid", aoVivo, isPortfolio, likeCounts }: Props) {
  const router = useRouter();

  // ─── Entrega gratuita (allow_downloads = true): a galeria é só pra
  // entregar, não pra vender — não importa se "pedir nome" ainda está
  // ligado nas configurações, o cliente entra direto nas fotos. ───
  const pedirNome = requireClientName && !allowDownloads;

  // ─── Boas-vindas animada (fade in/out), antes de tudo o mais ───
  const boasVindas = parseWelcomeMessage(welcomeMessageRaw);
  const temBoasVindas = !isPortfolio && hasWelcomeMessage(welcomeMessageRaw);
  const [introVista, setIntroVista] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(`titan_boas_vindas_${shareToken}`) === "1"; } catch { return false; }
  });
  function concluirIntro() {
    setIntroVista(true);
    try { sessionStorage.setItem(`titan_boas_vindas_${shareToken}`, "1"); } catch { /* sem storage disponível, só não repete nesta sessão */ }
  }

  // ─── Portfólio público: sem gate de nome, coraçãozinho = curtida simples ───
  const [anonId, setAnonId] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [likeTotals, setLikeTotals] = useState<Record<string, number>>(likeCounts ?? {});
  useEffect(() => {
    if (!isPortfolio) return;
    try {
      let id = localStorage.getItem(`titan_visitante_${shareToken}`);
      if (!id) { id = `visitante-${crypto.randomUUID()}`; localStorage.setItem(`titan_visitante_${shareToken}`, id); }
      setAnonId(id);
      const curtidas = JSON.parse(localStorage.getItem(`titan_curtidas_${shareToken}`) || "[]");
      if (Array.isArray(curtidas)) setLiked(new Set(curtidas));
    } catch { setAnonId(`visitante-${Math.random().toString(16).slice(2)}`); }
  }, [isPortfolio, shareToken]);
  async function like(id: string) {
    if (!anonId) return;
    const value = !liked.has(id);
    setLiked((old) => { const next = new Set(old); value ? next.add(id) : next.delete(id); try { localStorage.setItem(`titan_curtidas_${shareToken}`, JSON.stringify([...next])); } catch {} return next; });
    setLikeTotals((old) => ({ ...old, [id]: Math.max(0, (old[id] ?? 0) + (value ? 1 : -1)) }));
    try { await fetch(`/api/galeria-publica/${shareToken}/selecionar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: id, clientIdentifier: anonId, favorited: value }) }); } catch { /* curtida é só um extra, não trava a navegação do portfólio */ }
  }

  // ─── Galeria de entrega: nome do pagador, favoritar = selecionar p/ comprar ───
  const [name, setName] = useState<string | null>(null); const [nameInput, setNameInput] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set()); const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState(initialOrderId || ""); const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<string[]>([]); const [copied, setCopied] = useState(false); const [copiedPayload, setCopiedPayload] = useState(false);
  const request = useRef<{ key: string; requestId: string; accessToken: string } | null>(null);
  const paymentHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (isPortfolio) return; try { const stored = localStorage.getItem(`titan_galeria_id_${shareToken}`); if (stored && fullName(stored)) setName(stored); const ids = JSON.parse(localStorage.getItem(`titan_pedidos_${shareToken}`) || "[]"); if (Array.isArray(ids)) setHistory(ids.filter((v) => typeof v === "string").slice(0, 20)); } catch { /* armazenamento pode estar indisponível */ } }, [shareToken, isPortfolio]);
  // ─── Entrega gratuita (require_client_name = false): sem formulário de nome,
  // cliente entra direto nas fotos. Usa um identificador de convidado só pra
  // manter favoritar funcionando, igual ao portfólio público. ───
  useEffect(() => {
    if (isPortfolio || pedirNome) return;
    try {
      let id = localStorage.getItem(`titan_convidado_${shareToken}`);
      if (!id) { id = `convidado-${crypto.randomUUID()}`; localStorage.setItem(`titan_convidado_${shareToken}`, id); }
      setName(id);
    } catch { setName(`convidado-${Math.random().toString(16).slice(2)}`); }
  }, [isPortfolio, pedirNome, shareToken]);
  useEffect(() => { if (!aoVivo) return; const timer = setInterval(() => router.refresh(), 15000); return () => clearInterval(timer); }, [aoVivo, router]);
  useEffect(() => {
    if (!orderId) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let attempts = 0;
    setOrder(null);
    async function check() {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") { timer = setTimeout(check, 30000); return; }
      try {
        const res = await fetch(`/api/downloads/${orderId}`, { cache: "no-store", signal: controller.signal }); const data = await res.json();
        if (controller.signal.aborted) return;
        if (!res.ok) { setError(data.error || "Não foi possível consultar o pedido."); return; }
        setOrder(data);
        if (data.status === "pending") timer = setTimeout(check, ++attempts <= 3 ? 5000 : 30000);
      } catch { if (!controller.signal.aborted) { setError("Falha de conexão ao consultar o pedido. Use Atualizar pedido."); } }
    }
    function resume() { if (document.visibilityState === "visible") void check(); }
    void check(); document.addEventListener("visibilitychange", resume);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", resume); };
  }, [orderId]);
  async function refreshOrder() { if (!orderId) return; setError(null); try { const res = await fetch(`/api/downloads/${orderId}`, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setOrder(data); } catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão."); } }
  function identify(e: React.FormEvent) { e.preventDefault(); if (!fullName(nameInput)) { setError("Informe nome e sobrenome como aparecem no comprovante do Pix."); return; } const value = nameInput.trim().replace(/\s+/g, " "); setName(value); setError(null); try { localStorage.setItem(`titan_galeria_id_${shareToken}`, value); } catch {} }
  const individual = produtos.find((p) => p.type === "download_single");
  // O coraçãozinho é o único controle de seleção: favoritar já marca a foto
  // pra compor o pedido quando existe preço por arquivo (download_single).
  // Sem esse produto cadastrado, favoritar vira só um sinal pro fotógrafo.
  async function favorite(id: string) {
    if (!name) return; const value = !favorites.has(id);
    setFavorites((old) => { const next = new Set(old); value ? next.add(id) : next.delete(id); return next; });
    if (individual) setSelected((old) => { const next = new Set(old); value ? next.add(id) : next.delete(id); return next; });
    try { await fetch(`/api/galeria-publica/${shareToken}/selecionar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: id, clientIdentifier: name, favorited: value }) }); } catch { setError("Não foi possível salvar o favorito."); }
  }
  async function buy(product: Produto, ids: string[]) {
    if (!name || busy) return; setBusy(true); setError(null); setCopied(false);
    const key = JSON.stringify([shareToken, product.id, ids.slice().sort(), name]);
    if (request.current?.key !== key) request.current = { key, requestId: crypto.randomUUID(), accessToken: Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, "0")).join("") };
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareToken, productId: product.id, mediaIds: ids, clientIdentifier: name, requestId: request.current.requestId, accessToken: request.current.accessToken }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Não foi possível criar o pedido.");
      request.current = null; setOrderId(data.orderId);
      const idsHistory = [data.orderId, ...history.filter((id) => id !== data.orderId)].slice(0, 20); setHistory(idsHistory);
      try { localStorage.setItem(`titan_pedidos_${shareToken}`, JSON.stringify(idsHistory)); } catch {}
      setTimeout(() => paymentHeading.current?.focus(), 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }

  const coverPhoto = midias.find((m) => m.id === cover?.mediaId && m.type === "photo") || midias.find((m) => m.type === "photo");
  const hero = <GalleryCover design={cover} imageUrl={coverPhoto?.previewUrl} title={title} photographer={photographerName} />;

  // ─── Boas-vindas animada: aparece antes de tudo, inclusive da capa ───
  if (temBoasVindas && !introVista) {
    return <WelcomeIntro title={boasVindas.title} body={boasVindas.body} font={boasVindas.font} onDone={concluirIntro} />;
  }

  // ─── Portfólio público: galeria simples, sem gate, sem venda ───
  if (isPortfolio) {
    return <>{hero}<main id="galeria" className="mx-auto max-w-[1600px] px-2 py-6 sm:px-5">
      <header className="mb-6"><Live enabled={aoVivo}/><h1 className="text-2xl font-semibold">{title}</h1>{clientName && <p className="mt-1 text-sm text-neutral-500">{clientName}</p>}</header>
      <div className={template === "grid" ? "grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4" : LAYOUT_GRID[template]}>{midias.map((m, index) => <article key={m.id} className={`group relative overflow-hidden rounded-lg bg-neutral-100 ${LAYOUT_ITEM[template]}`}>
        {m.type === "photo" ? <img src={m.previewUrl} alt={`Foto ${index + 1}`} loading="lazy" className={template === "grid" ? "h-full w-full object-cover" : "h-auto w-full object-cover"}/> : <video src={m.previewUrl} controls className={template === "grid" ? "h-full w-full object-cover" : "h-auto w-full object-cover"}/>}
        {allowFavorites && <button aria-label={`Curtir foto ${index + 1}`} onClick={() => void like(m.id)} className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-3 py-2 text-white"><span>{liked.has(m.id) ? "♥" : "♡"}</span>{!!likeTotals[m.id] && <span className="text-xs">{likeTotals[m.id]}</span>}</button>}
      </article>)}</div>
      {!midias.length && <p className="py-10 text-center text-sm text-neutral-500">As fotos ainda serão enviadas pelo profissional.</p>}
      <Brand show={marcaTitan}/>
    </main></>;
  }

  if (pedirNome && !name) return <>{hero}<main id="galeria" className="mx-auto flex max-w-md flex-col justify-center px-6 py-12"><Live enabled={aoVivo}/><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-relaxed text-neutral-600">Para escolher e comprar arquivos, informe seu nome completo <strong>exatamente como aparece no comprovante do Pix</strong>. O profissional usará esse nome para conferir seu pagamento.</p><form onSubmit={identify} className="mt-6 space-y-3"><label className="block text-sm">Nome completo<input required autoComplete="name" maxLength={200} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nome e sobrenome do pagador" className="mt-2 block w-full rounded-lg border px-4 py-3"/></label><button className="w-full rounded-full bg-ink px-5 py-3 text-sm text-paper">Ver galeria</button></form>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<Brand show={marcaTitan}/></main></>;
  const packages = produtos.filter((p) => p.type === "download_all"); const prints = produtos.filter((p) => p.type === "print");
  return <>{hero}<main id="galeria" className="mx-auto max-w-[1600px] px-2 py-6 sm:px-5"><header className="mb-6"><Live enabled={aoVivo}/><h1 className="text-2xl font-semibold">{title}</h1>{clientName && <p className="mt-1 text-sm text-neutral-500">{clientName}</p>}{pedirNome && <p className="mt-3 text-sm text-neutral-600">Olá, {name}. <button className="underline" onClick={() => { setNameInput(name as string); setName(null); }}>Corrigir nome do pagador</button></p>}</header>
    {allowDownloads && !!midias.length && <div className="mb-4"><a href={`/api/g/${shareToken}/download?all=1`} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper">⬇ Baixar todas as fotos (.zip)</a></div>}
    {!!produtos.length && <aside className="mb-6 rounded-xl bg-neutral-100 p-4 text-sm leading-relaxed">{individual ? <>Toque no coraçãozinho ♡ das fotos que você quer comprar — elas entram na sua lista abaixo. Você paga o Pix <strong>diretamente ao profissional</strong>, envia o comprovante pelo WhatsApp e aguarda a liberação manual dos downloads.</> : <>Escolha o pacote desta galeria. Você paga o Pix <strong>diretamente ao profissional</strong>, envia o comprovante pelo WhatsApp e aguarda a liberação manual dos downloads.</>}</aside>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!!history.length && <label className="mb-5 block text-sm">Meus pedidos neste navegador<select value={orderId} onChange={(e) => { setOrderId(e.target.value); setError(null); }} className="ml-2 rounded-lg border px-3 py-2"><option value="">Selecione um pedido</option>{history.map((id) => <option key={id} value={id}>Pedido {id.slice(0, 8)}</option>)}</select></label>}
    {orderId && <section className="mb-8 rounded-2xl border bg-white p-5"><h2 ref={paymentHeading} tabIndex={-1} className="text-lg font-semibold">Pedido {orderId.slice(0, 8)}</h2>{!order ? <p role="status" className="mt-3 text-sm">Consultando pedido…</p> : <><p className="mt-2 text-sm">{order.clientName || name} · <strong>{money(order.totalCents || 0)}</strong> · {order.items?.length || order.links.length} arquivos</p><p className="mt-1 text-xs text-neutral-500">{order.items?.[0]?.product_name}</p>{order.status === "pending" ? <>{(order.merchantName || order.merchantAvatarUrl) && <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">{order.merchantAvatarUrl ? <img src={order.merchantAvatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs">{(order.merchantName || "?").slice(0, 1).toUpperCase()}</span>}<span>Pagamento para <strong>{order.merchantName || "o profissional"}</strong></span></div>}<ol className="mt-4 list-inside list-decimal space-y-2 text-sm"><li>Confira o total e pague com o QR Code ou a chave Pix abaixo.</li><li>Envie o comprovante no WhatsApp do profissional.</li><li>Aguarde a conferência e a liberação deste pedido.</li></ol>{order.pixQrDataUrl && <div className="mt-4 flex flex-col items-center gap-2 rounded-lg bg-neutral-50 p-4"><img src={order.pixQrDataUrl} alt="QR Code Pix" width={200} height={200} className="h-48 w-48" /><p className="text-xs text-neutral-500">Aponte a câmera do app do seu banco</p></div>}<div className="mt-4 rounded-lg bg-neutral-50 p-4"><p className="text-xs text-neutral-500">Chave Pix do profissional</p><p className="mt-1 break-all font-medium">{order.pixKey}</p><button className="mt-2 text-sm underline" onClick={async () => { try { await navigator.clipboard.writeText(order.pixKey); setCopied(true); } catch { setError("Selecione e copie a chave Pix exibida acima."); } }}>{copied ? "Chave copiada" : "Copiar chave Pix"}</button></div>{order.pixPayload && <div className="mt-3 rounded-lg bg-neutral-50 p-4"><p className="text-xs text-neutral-500">Pix copia e cola</p><p className="mt-1 break-all font-mono text-xs text-neutral-700">{order.pixPayload}</p><button className="mt-2 text-sm underline" onClick={async () => { try { await navigator.clipboard.writeText(order.pixPayload!); setCopiedPayload(true); } catch { setError("Selecione e copie o código Pix exibido acima."); } }}>{copiedPayload ? "Código copiado" : "Copiar código Pix"}</button></div>}{order.whatsappUrl && <a target="_blank" rel="noopener noreferrer" href={order.whatsappUrl} className="mt-4 inline-block rounded-full bg-green-700 px-5 py-2.5 text-sm text-white">Enviar comprovante no WhatsApp</a>}<p role="status" className="mt-4 text-sm text-amber-800">Aguardando o profissional confirmar o recebimento. O comprovante não libera arquivos automaticamente.</p></> : order.status === "canceled" ? <p className="mt-4 text-sm text-red-700">Pedido cancelado. Fale com o profissional se já realizou o pagamento.</p> : <div className="mt-4"><p role="status" className="text-sm font-medium text-green-800">Pagamento conferido pelo profissional.</p>{order.links.length ? <div className="mt-3 flex flex-wrap gap-2">{order.links.map((link, i) => <a key={link.mediaId} href={link.url} className="rounded-lg border px-4 py-2 text-sm underline">Baixar arquivo {i + 1}</a>)}</div> : <p className="mt-2 text-sm">Impressão confirmada. Combine a produção e a entrega com o profissional.</p>}</div>}<button onClick={() => void refreshOrder()} className="mt-4 block text-sm underline">Atualizar pedido</button><p className="mt-3 text-xs text-neutral-500">Volte a este mesmo navegador para consultar o pedido e baixar os arquivos liberados.</p></>}</section>}
    {!!packages.length && <div className="mb-6 flex flex-wrap gap-3">{packages.map((p) => <button key={p.id} disabled={busy || !midias.length} onClick={() => void buy(p, [])} className="rounded-full bg-ink px-5 py-3 text-sm text-paper disabled:opacity-50">{p.name} · {money(p.price_cents)} · Pedir via Pix</button>)}</div>}
    {individual && <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm"><p className="text-sm">♥ {selected.size} {selected.size === 1 ? "foto escolhida" : "fotos escolhidas"} · {money(individual.price_cents)} por arquivo</p><button disabled={busy || !selected.size} onClick={() => void buy(individual, [...selected])} className="rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50">Comprar selecionadas · {money(individual.price_cents * selected.size)}</button></div>}
    <div className={template === "grid" ? "grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4" : LAYOUT_GRID[template]}>{midias.map((m, index) => <article key={m.id} className={`group relative overflow-hidden rounded-lg bg-neutral-100 ${LAYOUT_ITEM[template]}`}>{m.type === "photo" ? <img src={m.previewUrl} alt={`Foto ${index + 1}`} loading="lazy" className={template === "grid" ? "h-full w-full object-cover" : "h-auto w-full object-cover"}/> : <video src={m.previewUrl} controls className={template === "grid" ? "h-full w-full object-cover" : "h-auto w-full object-cover"}/>}{!!prints.length && m.type === "photo" && <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-black/70 p-2 text-xs text-white">{prints.map((p) => <button disabled={busy} key={p.id} onClick={() => void buy(p, [m.id])} className="rounded bg-white px-2 py-1 text-ink">{p.name} · {money(p.price_cents)}</button>)}</div>}{allowDownloads && m.type === "photo" && <a href={`/api/g/${shareToken}/download?mediaId=${m.id}`} aria-label={`Baixar arquivo ${index + 1}`} className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-2 text-white">⬇</a>}{allowFavorites && <button aria-label={individual ? (favorites.has(m.id) ? `Remover arquivo ${index + 1} da compra` : `Escolher arquivo ${index + 1} para comprar`) : `Favoritar arquivo ${index + 1}`} onClick={() => void favorite(m.id)} className={`absolute ${allowDownloads ? "right-14" : "right-2"} top-2 rounded-full px-3 py-2 text-white ${favorites.has(m.id) ? "bg-ink" : "bg-black/60"}`}>{favorites.has(m.id) ? "♥" : "♡"}</button>}</article>)}</div>{!midias.length && <p className="py-10 text-center text-sm text-neutral-500">As fotos ainda serão enviadas pelo profissional.</p>}<Brand show={marcaTitan}/></main></>;
}
