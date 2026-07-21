import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

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
              "rounded-lg border p-4",
              negative
                ? "border-destructive/40 bg-destructive/5"
                : "border-emerald-600/30 bg-emerald-600/5",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium capitalize">
                  {formatMonthLong(month.month)}
                </p>
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    negative ? "text-destructive" : "text-emerald-700 dark:text-emerald-500",
                  )}
                >
                  {formatBRL(month.endBalanceCents)}
                </p>
              </div>

              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
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
            </div>

            {month.openingBalanceCents !== 0 || month.drivers.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1 border-t pt-3">
                {month.openingBalanceCents !== 0 ? (
                  <li className="flex justify-between gap-2 text-xs text-emerald-600 dark:text-emerald-500">
                    <span className="truncate">Saldo que você já tem</span>
                    <span className="shrink-0 tabular-nums">
                      {month.openingBalanceCents >= 0 ? "+" : "−"}
                      {formatBRL(Math.abs(month.openingBalanceCents))}
                    </span>
                  </li>
                ) : null}
                {month.drivers.map((driver) => (
                  <li
                    key={driver.label}
                    className="text-muted-foreground flex justify-between gap-2 text-xs"
                  >
                    <span className="truncate">{driver.label}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatBRL(driver.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
