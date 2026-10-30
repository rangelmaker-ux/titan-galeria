import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Titan Galeria",
  description:
    "Galerias de entrega e aprovação, loja de prints e downloads, e portfólio público — tudo num só lugar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Titan Galeria" },
};

// Garante que a largura siga a tela (evita rolagem horizontal). NÃO
// desativamos o zoom aqui (userScalable/maximumScale) — isso bloquearia até
// o zoom manual (pinça), que é ruim pra acessibilidade e o celular ignora de
// qualquer forma em boa parte dos casos. O zoom automático indesejado (ao
// focar um campo, ou ao tocar duas vezes) é resolvido de verdade no
// globals.css: campo com fonte abaixo de 16px é o que faz o iOS dar zoom ao
// focar, e touch-action: manipulation tira o zoom de toque duplo sem tocar
// no zoom de pinça.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0c0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
