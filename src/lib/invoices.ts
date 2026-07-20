/**
 * Em que fatura cai uma compra no crédito.
 *
 * Modelo: a fatura é identificada pelo **mês do vencimento** (`invoice_month`,
 * sempre dia 1). Uma compra entra na fatura que ainda não fechou:
 *
 *   compra no dia <= closing_day  → fecha neste mês
 *   compra no dia >  closing_day  → fecha no mês seguinte
 *
 * e o vencimento é no mesmo mês do fechamento se `due_day > closing_day`
 * (ex.: fecha dia 5, vence dia 12), ou no mês seguinte se `due_day <= closing_day`
 * (ex.: fecha dia 28, vence dia 5).
 *
 * Dias são limitados a 1–28 no banco, então não há clamp de fevereiro aqui.
 */

import { addMonthsToMonth, dayInMonth, monthOf, parseParts, type DateStr, type MonthStr } from "./dates";

export type InvoiceCycle = {
  closingDay: number;
  dueDay: number;
};

/** Mês da fatura (dia 1) em que uma compra feita em `date` vai cair. */
export function invoiceMonthFor(date: DateStr, cycle: InvoiceCycle): MonthStr {
  const { day } = parseParts(date);
  const purchaseMonth = monthOf(date);

  const closingMonth = day <= cycle.closingDay ? purchaseMonth : addMonthsToMonth(purchaseMonth, 1);

  return cycle.dueDay > cycle.closingDay ? closingMonth : addMonthsToMonth(closingMonth, 1);
}

/** Data de vencimento da fatura de um dado `invoice_month`. */
export function invoiceDueDate(invoiceMonth: MonthStr, cycle: InvoiceCycle): DateStr {
  return dayInMonth(invoiceMonth, cycle.dueDay);
}

/** Data em que a fatura de um dado `invoice_month` fecha (antes do vencimento). */
export function invoiceClosingDate(invoiceMonth: MonthStr, cycle: InvoiceCycle): DateStr {
  const closingMonth =
    cycle.dueDay > cycle.closingDay ? invoiceMonth : addMonthsToMonth(invoiceMonth, -1);
  return dayInMonth(closingMonth, cycle.closingDay);
}

/** A fatura ainda aceita compras novas? (i.e. não fechou até `reference`) */
export function isInvoiceOpen(
  invoiceMonth: MonthStr,
  cycle: InvoiceCycle,
  reference: DateStr,
): boolean {
  return reference <= invoiceClosingDate(invoiceMonth, cycle);
}

/**
 * Meses de fatura das N parcelas de uma compra parcelada:
 * a 1ª cai na fatura normal da compra, as seguintes nos meses subsequentes.
 */
export function installmentInvoiceMonths(
  date: DateStr,
  cycle: InvoiceCycle,
  count: number,
): MonthStr[] {
  const first = invoiceMonthFor(date, cycle);
  return Array.from({ length: count }, (_, i) => addMonthsToMonth(first, i));
}
