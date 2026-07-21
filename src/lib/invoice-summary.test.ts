import { describe, expect, it } from "vitest";

import { buildInvoices, limitStatus, usedLimitCents } from "./invoice-summary";

// O cartão do caso reportado: fecha dia 12, vence dia 18.
const cycle = { closingDay: 12, dueDay: 18 };

const purchase = (invoiceMonth: string, cents: number) => ({
  type: "expense" as const,
  amount_cents: cents,
  invoice_month: invoiceMonth,
  payment_method: "credito" as const,
  is_invoice_payment: false,
  affects_balance: true,
});

const refund = (invoiceMonth: string, cents: number) => ({
  type: "income" as const,
  amount_cents: cents,
  invoice_month: invoiceMonth,
  payment_method: "credito" as const,
  is_invoice_payment: false,
  affects_balance: true,
});

const payment = (invoiceMonth: string, cents: number) => ({
  type: "expense" as const,
  amount_cents: cents,
  invoice_month: invoiceMonth,
  payment_method: "pix" as const,
  is_invoice_payment: true,
  affects_balance: true,
});

const historicalPayment = (invoiceMonth: string, cents: number) => ({
  type: "expense" as const,
  amount_cents: cents,
  invoice_month: invoiceMonth,
  payment_method: "pix" as const,
  is_invoice_payment: true,
  affects_balance: false,
});

describe("pagamento histórico", () => {
  it("quita a fatura mas não conta como pagamento que mexe no saldo", () => {
    const [invoice] = buildInvoices(
      [purchase("2026-08-01", 12000), historicalPayment("2026-08-01", 12000)],
      cycle,
      "2026-08-20",
    );
    expect(invoice.isPaid).toBe(true);
    expect(invoice.paidCents).toBe(12000);
    expect(invoice.paymentAffectsBalance).toBe(false);
  });

  it("pagamento normal marca que mexe no saldo", () => {
    const [invoice] = buildInvoices(
      [purchase("2026-08-01", 12000), payment("2026-08-01", 12000)],
      cycle,
      "2026-08-20",
    );
    expect(invoice.paymentAffectsBalance).toBe(true);
  });
});

describe("buildInvoices", () => {
  it("a compra de 20/07 aparece na fatura de agosto, que vence em 18/08", () => {
    const [invoice] = buildInvoices([purchase("2026-08-01", 12000)], cycle, "2026-07-20");

    expect(invoice.month).toBe("2026-08-01");
    expect(invoice.totalCents).toBe(12000);
    expect(invoice.closingDate).toBe("2026-08-12");
    expect(invoice.dueDate).toBe("2026-08-18");
    expect(invoice.isOpen).toBe(true);
    expect(invoice.isPaid).toBe(false);
  });

  it("estorno abate a fatura", () => {
    const [invoice] = buildInvoices(
      [purchase("2026-08-01", 12000), refund("2026-08-01", 2000)],
      cycle,
      "2026-07-20",
    );
    expect(invoice.totalCents).toBe(10000);
  });

  it("pagamento quita a fatura", () => {
    const [invoice] = buildInvoices(
      [purchase("2026-08-01", 12000), payment("2026-08-01", 12000)],
      cycle,
      "2026-08-20",
    );
    expect(invoice.paidCents).toBe(12000);
    expect(invoice.outstandingCents).toBe(0);
    expect(invoice.isPaid).toBe(true);
  });

  it("pagamento parcial deixa o resto em aberto", () => {
    const [invoice] = buildInvoices(
      [purchase("2026-08-01", 12000), payment("2026-08-01", 5000)],
      cycle,
      "2026-08-20",
    );
    expect(invoice.outstandingCents).toBe(7000);
    expect(invoice.isPaid).toBe(false);
  });

  it("fecha no dia do fechamento e não aceita mais compras depois", () => {
    const onClosing = buildInvoices([purchase("2026-08-01", 100)], cycle, "2026-08-12");
    const afterClosing = buildInvoices([purchase("2026-08-01", 100)], cycle, "2026-08-13");
    expect(onClosing[0].isOpen).toBe(true);
    expect(afterClosing[0].isOpen).toBe(false);
  });

  it("ordena da fatura mais recente para a mais antiga", () => {
    const invoices = buildInvoices(
      [
        purchase("2026-08-01", 100),
        purchase("2026-06-01", 100),
        purchase("2026-07-01", 100),
      ],
      cycle,
      "2026-07-20",
    );
    expect(invoices.map((i) => i.month)).toEqual([
      "2026-08-01",
      "2026-07-01",
      "2026-06-01",
    ]);
  });

  it("ignora transações sem invoice_month", () => {
    const invoices = buildInvoices(
      [{ ...purchase("2026-08-01", 100), invoice_month: null }],
      cycle,
      "2026-07-20",
    );
    expect(invoices).toEqual([]);
  });
});

describe("usedLimitCents", () => {
  it("soma só o que ainda se deve", () => {
    const invoices = buildInvoices(
      [
        purchase("2026-07-01", 50000),
        payment("2026-07-01", 50000), // quitada, devolve limite
        purchase("2026-08-01", 30000),
      ],
      cycle,
      "2026-08-01",
    );
    expect(usedLimitCents(invoices)).toBe(30000);
  });

  it("fatura paga a mais não vira limite extra", () => {
    const invoices = buildInvoices(
      [purchase("2026-07-01", 10000), payment("2026-07-01", 15000)],
      cycle,
      "2026-08-01",
    );
    expect(usedLimitCents(invoices)).toBe(0);
  });
});

describe("limitStatus", () => {
  it("acende amarelo acima de 80% e vermelho ao estourar", () => {
    expect(limitStatus(50000, 100000)).toBe("ok");
    expect(limitStatus(80000, 100000)).toBe("ok");
    expect(limitStatus(80001, 100000)).toBe("warning");
    expect(limitStatus(100000, 100000)).toBe("warning");
    expect(limitStatus(100001, 100000)).toBe("exceeded");
  });
});
