/**
 * Série de entradas × saídas por mês, para o gráfico do dashboard.
 *
 * Mesma regra do resumo do mês: pagamento de fatura não conta como saída — a
 * compra já foi contada no mês em que aconteceu.
 */

import { monthOf, monthSequence, type MonthStr } from "./dates";
import type { Transaction } from "@/types/database";

export type MonthPoint = {
  month: MonthStr;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
};

type SeriesInput = Pick<
  Transaction,
  "date" | "type" | "amount_cents" | "is_invoice_payment"
>;

export function monthlySeries(
  transactions: SeriesInput[],
  from: MonthStr,
  to: MonthStr,
): MonthPoint[] {
  const points = new Map<MonthStr, MonthPoint>();

  // Meses sem movimento precisam existir com zero: um buraco no eixo faria
  // parecer que o mês não aconteceu.
  for (const month of monthSequence(from, to)) {
    points.set(month, { month, incomeCents: 0, expenseCents: 0, balanceCents: 0 });
  }

  for (const transaction of transactions) {
    const point = points.get(monthOf(transaction.date));
    if (!point) continue;

    if (transaction.type === "income") {
      point.incomeCents += transaction.amount_cents;
    } else if (!transaction.is_invoice_payment) {
      point.expenseCents += transaction.amount_cents;
    }
  }

  return [...points.values()].map((point) => ({
    ...point,
    balanceCents: point.incomeCents - point.expenseCents,
  }));
}
