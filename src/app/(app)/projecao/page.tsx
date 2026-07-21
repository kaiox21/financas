import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ProjectionCards } from "@/components/projection/projection-cards";
import { VariableEstimate } from "@/components/projection/variable-estimate";
import { formatMonthLong } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { materializeRecurring } from "@/lib/queries/materialize";
import { loadProjection } from "@/lib/queries/projection";

export const metadata: Metadata = { title: "Projeção" };

export default async function ProjecaoPage() {
  await materializeRecurring();
  const data = await loadProjection();

  return (
    <>
      <PageHeader
        title="Projeção"
        description="Próximos 6 meses, partindo do que você tem hoje."
      />

      <section className="mb-6 rounded-lg border p-4">
        <p className="text-muted-foreground text-xs">Ponto de partida</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatBRL(data.startingBalanceCents)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
          {formatBRL(data.accountsBalanceCents)} em contas
          {data.cardDebtCents > 0
            ? ` − ${formatBRL(data.cardDebtCents)} em faturas ainda não pagas`
            : ""}
        </p>
      </section>

      <div className="mb-6">
        <VariableEstimate
          usedCents={data.variableCents}
          estimateCents={data.variableEstimateCents}
          averageCents={data.variableAverageCents}
          windowMonths={data.averageWindow.length}
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
          Cada mês parte do saldo do anterior e soma as recorrentes ativas, as
          parcelas já compromissadas e{" "}
          <strong>{formatBRL(data.variableCents)}</strong> de gasto variável —{" "}
          {data.variableEstimateCents !== null
            ? "o valor que você definiu"
            : `a média dos últimos ${data.averageWindow.length} meses do que não é recorrente nem parcela`}
          .
        </p>
        <p>
          Compras no crédito contam no mês em que foram feitas; o pagamento da
          fatura não conta de novo, senão o mesmo dinheiro sairia duas vezes. O que
          você já deve no cartão sai do ponto de partida.
        </p>
      </section>
    </>
  );
}
