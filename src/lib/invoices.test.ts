import { describe, expect, it } from "vitest";

import { addMonths, addMonthsToMonth } from "./dates";
import {
  installmentInvoiceMonths,
  invoiceClosingDate,
  invoiceDueDate,
  invoiceMonthFor,
  isInvoiceOpen,
} from "./invoices";

// Fecha dia 5, vence dia 12 — vencimento no mesmo mês do fechamento.
const nubank = { closingDay: 5, dueDay: 12 };
// Fecha dia 28, vence dia 5 — vencimento no mês seguinte ao fechamento.
const itau = { closingDay: 28, dueDay: 5 };

describe("invoiceMonthFor", () => {
  it("compra antes do fechamento cai na fatura que fecha no mesmo mês", () => {
    expect(invoiceMonthFor("2026-07-03", nubank)).toBe("2026-07-01");
  });

  it("compra no dia do fechamento ainda entra na fatura que fecha", () => {
    expect(invoiceMonthFor("2026-07-05", nubank)).toBe("2026-07-01");
  });

  it("compra depois do fechamento vai para a fatura seguinte", () => {
    expect(invoiceMonthFor("2026-07-06", nubank)).toBe("2026-08-01");
    expect(invoiceMonthFor("2026-07-31", nubank)).toBe("2026-08-01");
  });

  it("vira o ano corretamente", () => {
    expect(invoiceMonthFor("2026-12-20", nubank)).toBe("2027-01-01");
  });

  it("com vencimento antes do fechamento, o vencimento é no mês seguinte", () => {
    expect(invoiceMonthFor("2026-07-03", itau)).toBe("2026-08-01");
    expect(invoiceMonthFor("2026-07-28", itau)).toBe("2026-08-01");
    expect(invoiceMonthFor("2026-07-29", itau)).toBe("2026-09-01");
    expect(invoiceMonthFor("2026-12-29", itau)).toBe("2027-02-01");
  });
});

describe("invoiceDueDate / invoiceClosingDate", () => {
  it("vencimento é o due_day do próprio invoice_month", () => {
    expect(invoiceDueDate("2026-07-01", nubank)).toBe("2026-07-12");
    expect(invoiceDueDate("2026-08-01", itau)).toBe("2026-08-05");
  });

  it("fechamento precede o vencimento", () => {
    expect(invoiceClosingDate("2026-07-01", nubank)).toBe("2026-07-05");
    expect(invoiceClosingDate("2026-08-01", itau)).toBe("2026-07-28");
  });

  it("fechamento e vencimento são consistentes com a compra", () => {
    for (const cycle of [nubank, itau]) {
      for (const date of ["2026-01-01", "2026-03-05", "2026-07-06", "2026-11-28", "2026-12-31"]) {
        const month = invoiceMonthFor(date, cycle);
        expect(date <= invoiceClosingDate(month, cycle)).toBe(true);
        expect(invoiceClosingDate(month, cycle) < invoiceDueDate(month, cycle)).toBe(true);
      }
    }
  });
});

describe("isInvoiceOpen", () => {
  it("aberta até o dia do fechamento, fechada depois", () => {
    expect(isInvoiceOpen("2026-07-01", nubank, "2026-07-05")).toBe(true);
    expect(isInvoiceOpen("2026-07-01", nubank, "2026-07-06")).toBe(false);
  });
});

describe("installmentInvoiceMonths", () => {
  it("distribui as parcelas em meses consecutivos a partir da fatura da compra", () => {
    expect(installmentInvoiceMonths("2026-07-20", nubank, 3)).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  it("vira o ano", () => {
    expect(installmentInvoiceMonths("2026-11-20", nubank, 3)).toEqual([
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
  });

  it("as faturas são sempre meses consecutivos, sem repetir nem pular", () => {
    for (const cycle of [nubank, itau]) {
      for (const date of ["2026-01-31", "2026-01-15", "2026-07-06", "2026-12-29"]) {
        const months = installmentInvoiceMonths(date, cycle, 12);
        expect(new Set(months).size).toBe(12);
        months.forEach((month, i) => {
          expect(month).toBe(addMonthsToMonth(months[0], i));
        });
      }
    }
  });

  // Compra dia 31 num cartão que fecha dia 28: a 2ª parcela é exibida em 28/02
  // (o dia é limitado por fevereiro), que é exatamente o dia do fechamento.
  // Derivar a fatura dessa data colocaria as parcelas 1 e 2 na MESMA fatura —
  // por isso a fatura vem da sequência, e a data serve só para a parcela
  // aparecer no mês certo da lista.
  it("compra no dia 31 com fechamento no dia 28 não junta duas parcelas na mesma fatura", () => {
    const months = installmentInvoiceMonths("2026-01-31", itau, 3);
    expect(months).toEqual(["2026-03-01", "2026-04-01", "2026-05-01"]);

    const naive = [0, 1, 2].map((i) => invoiceMonthFor(addMonths("2026-01-31", i), itau));
    expect(naive).toEqual(["2026-03-01", "2026-03-01", "2026-05-01"]);
    expect(new Set(naive).size).toBe(2); // a armadilha, documentada
  });
});
