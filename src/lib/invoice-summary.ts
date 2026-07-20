/**
 * Agregação de faturas — função pura, sem banco, para poder ser testada.
 *
 * Uma fatura não é uma tabela: é o conjunto de transações de crédito com o
 * mesmo `invoice_month`. O que se deve dela é esse total menos o que já foi
 * pago (transações com `is_invoice_payment`).
 */

import { invoiceClosingDate, invoiceDueDate, type InvoiceCycle } from "./invoices";
import type { DateStr, MonthStr } from "./dates";
import type { Transaction } from "@/types/database";

export type Invoice = {
  month: MonthStr;
  closingDate: DateStr;
  dueDate: DateStr;
  /** Compras menos estornos. */
  totalCents: number;
  paidCents: number;
  /** O que ainda se deve. Zero ou negativo = quitada. */
  outstandingCents: number;
  isPaid: boolean;
  /** Ainda aceita compras novas? */
  isOpen: boolean;
};

type InvoiceInput = Pick<
  Transaction,
  "type" | "amount_cents" | "invoice_month" | "payment_method" | "is_invoice_payment"
>;

export function buildInvoices(
  transactions: InvoiceInput[],
  cycle: InvoiceCycle,
  reference: DateStr,
): Invoice[] {
  const totals = new Map<MonthStr, { total: number; paid: number }>();

  const bucket = (month: MonthStr) => {
    let entry = totals.get(month);
    if (!entry) {
      entry = { total: 0, paid: 0 };
      totals.set(month, entry);
    }
    return entry;
  };

  for (const transaction of transactions) {
    if (!transaction.invoice_month) continue;
    const entry = bucket(transaction.invoice_month);

    if (transaction.is_invoice_payment) {
      entry.paid += transaction.amount_cents;
    } else if (transaction.payment_method === "credito") {
      // Uma entrada no crédito é estorno: abate a fatura.
      entry.total +=
        transaction.type === "expense" ? transaction.amount_cents : -transaction.amount_cents;
    }
  }

  return [...totals.entries()]
    .map(([month, { total, paid }]) => {
      const closingDate = invoiceClosingDate(month, cycle);
      return {
        month,
        closingDate,
        dueDate: invoiceDueDate(month, cycle),
        totalCents: total,
        paidCents: paid,
        outstandingCents: total - paid,
        isPaid: total - paid <= 0,
        isOpen: reference <= closingDate,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Limite comprometido: tudo que ainda se deve, em qualquer fatura.
 * Faturas quitadas devolvem o limite; estornos também.
 */
export function usedLimitCents(invoices: Invoice[]): number {
  return invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.outstandingCents),
    0,
  );
}

export type LimitStatus = "ok" | "warning" | "exceeded";

/** >80% do limite acende amarelo; estourado, vermelho. */
export function limitStatus(usedCents: number, limitCents: number): LimitStatus {
  if (usedCents > limitCents) return "exceeded";
  if (limitCents > 0 && usedCents / limitCents > 0.8) return "warning";
  return "ok";
}
