"use client";

import { useEffect, useState } from "react";

type Foto = {
  src: string;
  legenda: string;
};

const FOTOS: Foto[] = [
  { src: "/images/landing/casamento.jpg", legenda: "Casamento" },
  { src: "/images/landing/15-anos.jpg", legenda: "15 anos" },
  { src: "/images/landing/familia.jpg", legenda: "Família" },
  { src: "/images/landing/natal.jpg", legenda: "Natal" },
  { src: "/images/landing/dia-das-criancas.jpg", legenda: "Dia das crianças" },
];

const ROTACOES = ["-rotate-3", "rotate-2", "-rotate-2", "rotate-3", "-rotate-1"];

export function HeroSlider() {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setAtual((i) => (i + 1) % FOTOS.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
      {FOTOS.map((foto, i) => (
        <div
          key={foto.src}
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-in-out ${
            i === atual ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div
            className={`rounded-sm bg-white p-3 pb-10 shadow-xl ring-1 ring-black/5 ${ROTACOES[i % ROTACOES.length]}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.src}
              alt={foto.legenda}
              width={900}
              height={1100}
              className="h-72 w-64 rounded-[2px] object-cover sm:h-80 sm:w-72"
            />
            <p className="mt-3 text-center font-serif text-sm italic text-neutral-500">
              {foto.legenda}
            </p>
          </div>
        </div>
      ))}

      <div className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5">
        {FOTOS.map((foto, i) => (
          <span
            key={foto.src}
            className={`h-1.5 w-1.5 rounded-full transition ${
              i === atual ? "bg-ink" : "bg-neutral-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
