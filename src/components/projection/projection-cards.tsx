import { AlertTriangle, ChevronDown, TrendingDown, TrendingUp } from "lucide-react";

import { formatMonthLong } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ProjectedMonth } from "@/lib/projection";

export function ProjectionCards({ months }: { months: ProjectedMonth[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {months.map((month) => {
        const negative = month.endBalanceCents < 0;

        return (
          <li
            key={month.month}
            className={cn(
              "rounded-lg border",
              negative
                ? "border-destructive/40 bg-destructive/5"
                : "border-emerald-600/30 bg-emerald-600/5",
            )}
          >
            {/* <details> abre/fecha nativo — detalhe fica escondido até clicar. */}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {formatMonthLong(month.month)}
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      negative
                        ? "text-destructive"
                        : "text-emerald-700 dark:text-emerald-500",
                    )}
                  >
                    {formatBRL(month.endBalanceCents)}
                  </p>
                  <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                    <span className="group-open:hidden">Ver detalhes</span>
                    <span className="hidden group-open:inline">Ocultar detalhes</span>
                  </p>
                </div>

                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                    negative
                      ? "bg-destructive/10 text-destructive"
                      : "bg-emerald-600/10 text-emerald-700 dark:text-emerald-500",
                  )}
                >
                  {negative ? (
                    <AlertTriangle className="size-3.5" />
                  ) : month.netCents >= 0 ? (
                    <TrendingUp className="size-3.5" />
                  ) : (
                    <TrendingDown className="size-3.5" />
                  )}
                  {month.netCents >= 0 ? "+" : "−"}
                  {formatBRL(Math.abs(month.netCents))}
                </span>
              </summary>

              <div className="flex flex-col gap-3 px-4 pb-4">
                <Breakdown
                  title="Entra"
                  openingBalanceCents={month.openingBalanceCents}
                  items={month.incomeItems}
                  positive
                />
                <Breakdown title="Sai" items={month.expenseItems} />

                <div className="flex items-center justify-between border-t pt-2 text-sm font-medium">
                  <span>Resultado do mês</span>
                  <span
                    className={cn(
                      "tabular-nums",
                      month.netCents < 0
                        ? "text-destructive"
                        : "text-emerald-700 dark:text-emerald-500",
                    )}
                  >
                    {month.netCents >= 0 ? "+" : "−"}
                    {formatBRL(Math.abs(month.netCents))}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>Saldo acumulado ao fim do mês</span>
                  <span className="tabular-nums">
                    {formatBRL(month.endBalanceCents)}
                  </span>
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function Breakdown({
  title,
  items,
  openingBalanceCents = 0,
  positive = false,
}: {
  title: string;
  items: { label: string; amountCents: number }[];
  openingBalanceCents?: number;
  positive?: boolean;
}) {
  const total =
    openingBalanceCents +
    items.reduce((sum, item) => sum + item.amountCents, 0);

  if (openingBalanceCents === 0 && items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs font-medium">
        <span>{title}</span>
        <span
          className={cn(
            "tabular-nums",
            positive && "text-emerald-700 dark:text-emerald-500",
          )}
        >
          {positive ? "+" : "−"}
          {formatBRL(total)}
        </span>
      </div>

      <ul className="flex flex-col gap-0.5">
        {openingBalanceCents !== 0 ? (
          <li className="text-muted-foreground flex justify-between gap-2 text-xs">
            <span className="truncate">Saldo que você já tem</span>
            <span className="shrink-0 tabular-nums">
              {formatBRL(openingBalanceCents)}
            </span>
          </li>
        ) : null}
        {items.map((item) => (
          <li
            key={item.label}
            className="text-muted-foreground flex justify-between gap-2 text-xs"
          >
            <span className="truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums">
              {formatBRL(item.amountCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
