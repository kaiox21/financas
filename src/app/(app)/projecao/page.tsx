import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { MoneyFigure } from "@/components/money-figure";
import { PageHeader } from "@/components/page-header";
import { BudgetPanel } from "@/components/projection/budget-panel";
import { ProjectionCards } from "@/components/projection/projection-cards";
import { formatMonthLong } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { listCategories } from "@/lib/queries/categories";
import { materializeRecurring } from "@/lib/queries/materialize";
import { loadProjection } from "@/lib/queries/projection";

export const metadata: Metadata = { title: "Projeção" };

export default async function ProjecaoPage() {
  await materializeRecurring();
  const [data, categories] = await Promise.all([loadProjection(), listCategories()]);

  return (
    <>
      <PageHeader
        title="Projeção"
        description="Próximos 6 meses, partindo do que você tem hoje."
      />

      <section className="mb-6 rounded-lg border p-4">
        <p className="eyebrow">Você tem hoje</p>
        <MoneyFigure cents={data.startingBalanceCents} size="lg" />
        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
          {formatBRL(data.accountsBalanceCents)} em contas
          {data.immediateBillsCents > 0
            ? ` − ${formatBRL(data.immediateBillsCents)} em faturas a vencer agora`
            : ""}{" "}
          — esse valor entra somado às entradas do primeiro mês.
        </p>
      </section>

      <div className="mb-6">
        <BudgetPanel
          lines={data.budgetLines}
          categories={categories}
          expenseCents={data.plannedExpenseCents}
          incomeCents={data.plannedIncomeCents}
          averageCents={data.variableAverageCents}
        />
      </div>

      {data.firstNegative ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive mb-6 flex items-start gap-2 rounded-lg border p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            No ritmo atual, o dinheiro acaba em{" "}
            <strong className="capitalize">
              {formatMonthLong(data.firstNegative)}
            </strong>
            .
          </p>
        </div>
      ) : null}

      <ProjectionCards months={data.months} />

      <section className="text-muted-foreground mt-6 flex flex-col gap-2 rounded-lg border border-dashed p-4 text-xs">
        <p className="text-foreground text-sm font-medium">Como a conta é feita</p>
        <p>
          Cada mês parte do saldo do anterior, soma as recorrentes ativas e as
          entradas planejadas (<strong>{formatBRL(data.plannedIncomeCents)}</strong>),
          e subtrai as parcelas já compromissadas e as saídas planejadas (
          <strong>{formatBRL(data.plannedExpenseCents)}</strong>) — as linhas de
          orçamento que você definiu acima.
        </p>
        <p>
          As faturas do cartão entram no mês em que <strong>vencem</strong> — cada
          uma aparece como um puxador no mês certo. Faturas que já vencem agora saem
          do que você tem hoje; as futuras se espalham pelos próximos meses.
        </p>
      </section>
    </>
  );
}
