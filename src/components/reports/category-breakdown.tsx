import { CategoryIcon } from "@/components/category-icon";
import { formatBRL } from "@/lib/money";
import type { CategoryReport, CategorySlice } from "@/lib/category-report";

/**
 * Duas leituras do mesmo mês:
 *  1. uma barra empilhada de 100% — a proporção, de relance;
 *  2. barras horizontais ordenadas — a magnitude, comparável.
 *
 * Não é pizza (o plano original dizia "pizza + barras"): nomes de categoria em
 * português são longos e fatias de tamanho parecido são difíceis de comparar
 * num círculo. Barra empilhada horizontal responde à mesma pergunta melhor.
 *
 * Não usa biblioteca de gráfico: são retângulos rotulados, e mantê-los em HTML
 * deixa tudo num Server Component, sem JS no cliente.
 *
 * Toda barra tem rótulo (ícone + nome + valor + fatia). Isso é deliberado: as
 * cores são escolhidas por você, então nenhum conjunto passa nos testes de
 * daltonismo — a identidade não pode depender da cor.
 */
export function CategoryBreakdown({ report }: { report: CategoryReport }) {
  if (report.totalCents === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        Nenhuma despesa neste mês.
      </p>
    );
  }

  const biggest = report.slices[0].amountCents;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground text-xs">Total de despesas</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatBRL(report.totalCents)}
        </p>
      </div>

      {/* Barra de 100%: proporção. O gap de 2px é a superfície, não uma borda. */}
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Divisão das despesas: ${report.slices
          .map((slice) => `${slice.name} ${percent(slice.share)}`)
          .join(", ")}`}
      >
        {report.slices.map((slice) => (
          <span
            key={slice.id}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${slice.share * 100}%`,
              backgroundColor: slice.color,
            }}
          />
        ))}
      </div>

      {/* Barras ordenadas: magnitude. Escala pela maior, não pelo total —
          comparar categorias entre si é a pergunta aqui. */}
      <ul className="flex flex-col gap-3">
        {report.slices.map((slice) => (
          <li key={slice.id} className="flex flex-col gap-1.5">
            <Row slice={slice} biggest={biggest} />

            {slice.children.length > 0 ? (
              <ul className="flex flex-col gap-1 pl-9">
                {slice.children.map((child) => (
                  <li
                    key={child.id}
                    className="text-muted-foreground flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate">{child.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatBRL(child.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ slice, biggest }: { slice: CategorySlice; biggest: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${slice.color}20`, color: slice.color }}
        aria-hidden
      >
        <CategoryIcon name={slice.icon} className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{slice.name}</span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatBRL(slice.amountCents)}
            <span className="ml-1.5">{percent(slice.share)}</span>
          </span>
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{
              width: `${(slice.amountCents / biggest) * 100}%`,
              backgroundColor: slice.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
