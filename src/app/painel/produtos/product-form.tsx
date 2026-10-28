"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tipo = "download_single" | "download_all" | "print";
const TIPOS: Record<Tipo, { nome: string; descricao: string; exemplo: string }> = {
  download_single: { nome: "Foto individual", descricao: "O cliente escolhe uma foto e compra o download do arquivo original.", exemplo: "Foto em alta resolução" },
  download_all: { nome: "Galeria completa", descricao: "Uma compra libera o download de todos os arquivos da galeria.", exemplo: "Todos os arquivos do evento" },
  print: { nome: "Foto impressa", descricao: "O cliente escolhe uma foto para impressão. Combine produção, entrega e frete diretamente com ele.", exemplo: "Foto impressa 15 × 21 cm" },
};

export function ProductForm({ galleries, initialGalleryId = "" }: { galleries: { id: string; title: string }[]; initialGalleryId?: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("download_single");
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [galleryId, setGalleryId] = useState(initialGalleryId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    const valor = preco.trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(valor)) {
      setErro("Informe o preço sem separador de milhar, por exemplo: 29,90.");
      return;
    }
    const centavos = Math.round(Number(valor.replace(",", ".")) * 100);
    if (!Number.isSafeInteger(centavos) || centavos <= 0) {
      setErro("O preço precisa ser maior que zero.");
      return;
    }
    if (!nome.trim()) { setErro("Informe o nome do produto."); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryId, type: tipo, name: nome.trim(), priceCents: centavos, printSize: tipo === "print" ? tamanho.trim() || undefined : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar o produto.");
      setNome(""); setPreco(""); setTamanho(""); setSucesso(true);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha de conexão. Tente novamente.");
    } finally { setSalvando(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Criar produto</h2>
      <p className="mt-1 text-sm text-neutral-500">Você vende os arquivos de uma galeria específica. O produto define o formato da compra e o preço.</p>
      <label className="mt-5 block text-sm font-medium">Em qual galeria os arquivos estão?
        <select required disabled={salvando} value={galleryId} onChange={(e) => setGalleryId(e.target.value)} className="mt-2 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 font-normal"><option value="" disabled>Selecione um álbum</option>{galleries.map((g) => <option value={g.id} key={g.id}>{g.title}</option>)}</select>
      </label>
      <fieldset disabled={salvando} className="mt-5">
        <legend className="mb-3 text-sm font-medium">1. O que você quer vender?</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(TIPOS) as Tipo[]).map((id) => (
            <label key={id} className={`cursor-pointer rounded-xl border p-4 ${tipo === id ? "border-ink bg-neutral-50 ring-1 ring-ink" : "border-neutral-200"}`}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <input type="radio" name="tipo" value={id} checked={tipo === id} onChange={() => setTipo(id)} />
                {TIPOS[id].nome}
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-neutral-600">{TIPOS[id].descricao}</span>
            </label>
          ))}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">2. Nome que aparece para o cliente
            <input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder={TIPOS[tipo].exemplo} className="mt-2 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-medium">3. Preço por compra (R$)
            <input required inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="29,90" aria-describedby="preco-ajuda" className="mt-2 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 font-normal" />
            <span id="preco-ajuda" className="mt-1 block text-xs font-normal text-neutral-500">{tipo === "download_all" ? "Valor pelo pacote completo, não por foto." : "Valor por foto selecionada."}</span>
          </label>
          {tipo === "print" && <label className="text-sm font-medium">Tamanho da impressão
            <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="15 × 21 cm" className="mt-2 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 font-normal" />
          </label>}
        </div>
        <button disabled={salvando} className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50">{salvando ? "Salvando…" : "Adicionar produto"}</button>
      </fieldset>
      {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
      {sucesso && <p role="status" className="mt-3 text-sm text-green-700">Produto criado e vinculado à galeria escolhida.</p>}
    </form>
  );
}
