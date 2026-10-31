"use client";
import { useEffect, useState } from "react";
import { COVER_FONTS, type CoverFont } from "@/lib/gallery-cover";

/** Tela de boas-vindas em fade-in, antes do fluxo normal da galeria
 * (nome do pagador / fotos). Some em fade-out quando o cliente clica em
 * "Ver" e aí sim revela o que já existia (capa + galeria). Só é montada
 * quando o fotógrafo escreveu um título ou texto — ver hasWelcomeMessage
 * em src/lib/welcome-message.ts. */
export function WelcomeIntro({ title, body, font, onDone }: { title: string; body: string; font: CoverFont; onDone: () => void }) {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisivel(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function ver() {
    setSaindo(true);
    setTimeout(onDone, 700);
  }

  return (
    <main
      role="dialog"
      aria-label="Boas-vindas"
      className={`fixed inset-0 z-50 flex min-h-[100svh] flex-col items-center justify-center overflow-y-auto bg-neutral-950 px-6 py-16 text-center text-white transition-opacity duration-700 ease-out ${visivel && !saindo ? "opacity-100" : "opacity-0"}`}
      style={{ fontFamily: COVER_FONTS[font].family }}
    >
      <div className="max-w-xl">
        {title && <h1 className="break-words text-3xl font-normal leading-tight sm:text-4xl">{title}</h1>}
        {body && <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-white/85 sm:text-lg">{body}</p>}
        <button
          type="button"
          onClick={ver}
          className="mt-10 inline-block border border-white/80 px-10 py-3 text-xs uppercase tracking-[0.2em] transition hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Ver galeria
        </button>
      </div>
    </main>
  );
}
