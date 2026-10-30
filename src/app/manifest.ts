import type { MetadataRoute } from "next";

/** Manifesto do PWA — permite "Adicionar à tela inicial" no celular com
 * ícone e nome certos, em vez do ícone genérico de navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Titan Galeria",
    short_name: "Titan Galeria",
    description:
      "Galerias de entrega e aprovação, loja de prints e downloads, e portfólio público para fotógrafos e videomakers.",
    start_url: "/painel",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#0b0c0f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
