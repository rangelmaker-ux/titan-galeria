import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Titan Galeria",
  description:
    "Galerias de entrega e aprovação, loja de prints e downloads, e portfólio público — tudo num só lugar.",
};

// Trava o zoom automático do celular (ex: ao focar um campo de texto) e
// garante que a largura siga a tela, evitando rolagem horizontal.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
