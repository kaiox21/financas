import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

// Figura de extrato: o "R$" e os centavos recuam para o segundo plano; os reais
// dominam, na grotesca do display. É a assinatura da interface — reusada em cada
// figura-herói para dar coesão, com tamanhos em hierarquia (o dashboard é o maior).
const SIZES = {
  hero: { reais: "text-6xl", affix: "text-lg", pad: "pt-2" },
  lg: { reais: "text-3xl", affix: "text-sm", pad: "pt-1" },
  md: { reais: "text-2xl", affix: "text-xs", pad: "pt-1" },
} as const;

export function MoneyFigure({
  cents,
  size = "lg",
  signed = false,
  toneClassName,
  className,
}: {
  cents: number;
  size?: keyof typeof SIZES;
  /** Mostra "+" nos positivos (para deltas como rendimento). */
  signed?: boolean;
  /** Sobrescreve a cor — por padrão, negativos ficam em vermelho. */
  toneClassName?: string;
  className?: string;
}) {
  const negative = cents < 0;
  const s = SIZES[size];
  const [reais, centavos] = formatBRL(Math.abs(cents))
    .replace("R$", "")
    .trim()
    .split(",");
  const sign = negative ? "−" : signed ? "+" : "";

  return (
    <p
      className={cn(
        "font-display flex items-baseline gap-1 tracking-tight tabular-nums",
        toneClassName ?? (negative ? "text-destructive" : "text-foreground"),
        className,
      )}
    >
      <span className={cn("text-muted-foreground self-start font-medium", s.affix, s.pad)}>
        R$
      </span>
      <span className={cn("leading-none font-semibold", s.reais)}>
        {sign}
        {reais}
      </span>
      <span className={cn("text-muted-foreground font-medium", s.affix)}>,{centavos}</span>
    </p>
  );
}
