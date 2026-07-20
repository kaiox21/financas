import { describe, expect, it } from "vitest";

import { summarize } from "./summary";

const income = (cents: number) => ({
  type: "income" as const,
  amount_cents: cents,
  is_invoice_payment: false,
});

const expense = (cents: number) => ({
  type: "expense" as const,
  amount_cents: cents,
  is_invoice_payment: false,
});

const invoicePayment = (cents: number) => ({
  type: "expense" as const,
  amount_cents: cents,
  is_invoice_payment: true,
});

describe("summarize", () => {
  it("mês vazio zera tudo", () => {
    expect(summarize([])).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      invoicePaymentCents: 0,
      balanceCents: 0,
    });
  });

  it("soma entradas e saídas", () => {
    const summary = summarize([income(500000), expense(120000), expense(30000)]);
    expect(summary.incomeCents).toBe(500000);
    expect(summary.expenseCents).toBe(150000);
    expect(summary.balanceCents).toBe(350000);
  });

  it("pagamento de fatura não conta como gasto novo", () => {
    const summary = summarize([income(500000), expense(20000), invoicePayment(234000)]);
    expect(summary.expenseCents).toBe(20000);
    expect(summary.invoicePaymentCents).toBe(234000);
    expect(summary.balanceCents).toBe(480000);
  });

  it("o mesmo dinheiro não é contado duas vezes entre compra e pagamento", () => {
    // Julho: compra de R$ 100 no crédito. Agosto: pagamento da fatura de R$ 100.
    const julho = summarize([expense(10000)]);
    const agosto = summarize([invoicePayment(10000)]);
    expect(julho.expenseCents + agosto.expenseCents).toBe(10000);
  });
});
