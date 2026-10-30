import Link from "next/link";

/** Marca da Titan Galeria: um "T" com corte diagonal nos dois cantos opostos
 * (mais ousado que um T reto), no preto/branco (ink/paper) que o resto do
 * site já usa. `invert` troca pra fundo claro + T escuro, pra usar em cima
 * de fundo escuro (ex: hero da tela de login). */
export function LogoMark({ size = 22, invert = false, className = "" }: { size?: number; invert?: boolean; className?: string }) {
  const bg = invert ? "#fafaf9" : "#0b0c0f";
  const fg = invert ? "#0b0c0f" : "#fafaf9";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <rect width="100" height="100" rx="22" fill={bg} />
      <polygon points="18,21.5 74,21.5 82,29.5 82,34.5 18,34.5" fill={fg} />
      <polygon points="43.5,21.5 56.5,21.5 56.5,78.5 49.5,78.5 43.5,70.5" fill={fg} />
    </svg>
  );
}

/** Ícone + "Titan Galeria", linkando pra home. Usado no topo de todas as
 * páginas públicas e no painel. */
export function Logo({ invert = false, size = 20, className = "", textClassName = "text-sm" }: { invert?: boolean; size?: number; className?: string; textClassName?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} invert={invert} />
      <span className={`font-semibold uppercase tracking-widest ${invert ? "text-white/75" : "text-neutral-500"} ${textClassName}`}>
        Titan Galeria
      </span>
    </Link>
  );
}
