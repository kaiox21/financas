import type { Transaction } from "@/types/database";

export type MonthSummary = {
  /** Receitas do mês. */
  incomeCents: number;
  /**
   * Despesas do mês, **sem** pagamentos de fatura: a compra no crédito já
   * contou como gasto no mês em que foi feita. Somar o pagamento de novo
   * contaria o mesmo dinheiro duas vezes.
   */
  expenseCents: number;
  /** Pagamentos de fatura — saem do caixa, mas não são gasto novo. */
  invoicePaymentCents: number;
  balanceCents: number;
};

type Summarizable = Pick<Transaction, "type" | "amount_cents" | "is_invoice_payment">;

export function summarize(transactions: Summarizable[]): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let invoicePaymentCents = 0;

  for (const transaction of transactions) {
    if (transaction.type === "income") {
      incomeCents += transaction.amount_cents;
    } else if (transaction.is_invoice_payment) {
      invoicePaymentCents += transaction.amount_cents;
    } else {
      expenseCents += transaction.amount_cents;
    }
  }

  return {
    incomeCents,
    expenseCents,
    invoicePaymentCents,
    balanceCents: incomeCents - expenseCents,
  };
}
