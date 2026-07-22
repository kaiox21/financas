import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CategoryIcon } from "@/components/category-icon";
import { MoneyFigure } from "@/components/money-figure";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { CategoryBreakdown } from "@/components/reports/category-breakdown";
import { MonthSummary } from "@/components/transactions/month-summary";
import { Button } from "@/components/ui/button";
import { formatDayMonth, formatMonthLong, formatMonthShort } from "@/lib/dates";
import { formatBRL, formatBRLShort } from "@/lib/money";
import { loadDashboard } from "@/lib/queries/dashboard";
import { materializeRecurring } from "@/lib/queries/materialize";
import { loadProjection } from "@/lib/queries/projection";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage() {
  await materializeRecurring();
  const [data, projection] = await Promise.all([loadDashboard(), loadProjection()]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1.5 border-b pb-6">
        <p className="eyebrow">Saldo em contas</p>
        <MoneyFigure cents={data.accountsBalanceCents} size="hero" />
        {data.investedCents > 0 ? (
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">
            + {formatBRL(data.investedCents)} investidos ={" "}
            <strong className="text-gold font-semibold">
              {formatBRL(data.netWorthCents)}
            </strong>{" "}
            de patrimônio
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow">{formatMonthLong(data.month)}</h2>
        <MonthSummary summary={data.summary} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Próximos meses</h2>
          <Button variant="ghost" size="sm" render={<Link href="/projecao" />}>
            Ver projeção
            <ChevronRight />
          </Button>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {projection.months.slice(0, 3).map((month) => {
            const negative = month.endBalanceCents < 0;
            return (
              <li
                key={month.month}
                className={cn(
                  "rounded-lg border p-3",
                  negative
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-emerald-600/30 bg-emerald-600/5",
                )}
              >
                <p className="text-muted-foreground text-xs capitalize">
                  {formatMonthShort(month.month)}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    negative
                      ? "text-destructive"
                      : "text-emerald-700 dark:text-emerald-500",
                  )}
                >
                  {formatBRLShort(month.endBalanceCents)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow">Entradas e saídas · 6 meses</h2>
        <IncomeExpenseChart data={data.series} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Gastos por categoria</h2>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/transacoes/relatorio" />}
          >
            Ver tudo
            <ChevronRight />
          </Button>
        </div>
        <CategoryBreakdown report={data.report} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Últimos lançamentos</h2>
          <Button variant="ghost" size="sm" render={<Link href="/transacoes" />}>
            Ver tudo
            <ChevronRight />
          </Button>
        </div>

        {data.recent.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Nenhum lançamento ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {data.recent.map((transaction) => (
              <li key={transaction.id} className="flex items-center gap-3 p-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `${transaction.category?.color ?? "#6b7280"}20`,
                    color: transaction.category?.color ?? "#6b7280",
                  }}
                  aria-hidden
                >
                  <CategoryIcon name={transaction.category?.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {transaction.description}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDayMonth(transaction.date)}
                    {transaction.category ? ` · ${transaction.category.name}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-medium tabular-nums",
                    transaction.type === "income"
                      ? "text-emerald-600 dark:text-emerald-500"
                      : "text-foreground",
                  )}
                >
                  {transaction.type === "income" ? "+" : "−"}
                  {formatBRL(transaction.amount_cents).replace("R$", "").trim()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
