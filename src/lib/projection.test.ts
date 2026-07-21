import { describe, expect, it } from "vitest";

import {
  firstNegativeMonth,
  project,
  variableAverage,
  type ProjectionRule,
} from "./projection";

const salario: ProjectionRule = {
  description: "Salário",
  amount_cents: 700000,
  type: "income",
  day_of_month: 5,
  start_date: "2026-01-05",
  end_date: null,
  active: true,
};

const aluguel: ProjectionRule = {
  description: "Aluguel",
  amount_cents: 250000,
  type: "expense",
  day_of_month: 10,
  start_date: "2026-01-10",
  end_date: null,
  active: true,
};

const MESES = ["2026-08-01", "2026-09-01", "2026-10-01"];

describe("project", () => {
  it("acumula: cada mês parte do saldo do anterior", () => {
    const result = project({
      startingBalanceCents: 100000,
      months: MESES,
      rules: [salario, aluguel],
      scheduled: [],
      plannedExpenses: [],
    });

    // +7000 −2500 = +4500 por mês
    expect(result[0].endBalanceCents).toBe(100000 + 450000);
    expect(result[1].endBalanceCents).toBe(100000 + 900000);
    expect(result[2].endBalanceCents).toBe(100000 + 1350000);
  });

  it("entradas planejadas somam à receita de todo mês", () => {
    const result = project({
      startingBalanceCents: 0,
      months: ["2026-08-01", "2026-09-01"],
      rules: [],
      scheduled: [],
      plannedExpenses: [{ label: "Aluguel", amountCents: 250000 }],
      plannedIncome: [{ label: "Freela", amountCents: 300000 }],
    });

    expect(result[0].incomeCents).toBe(300000);
    expect(result[0].expenseCents).toBe(250000);
    expect(result[0].netCents).toBe(50000);
    expect(result[1].endBalanceCents).toBe(100000);
    // entrada não vira "puxador" (esses são só as saídas)
    expect(result[0].drivers.map((d) => d.label)).toEqual(["Aluguel"]);
  });

  it("soma as linhas de orçamento em todo mês, cada uma como seu próprio custo", () => {
    const result = project({
      startingBalanceCents: 0,
      months: ["2026-08-01", "2026-09-01"],
      rules: [],
      scheduled: [],
      plannedExpenses: [
        { label: "Alimentação", amountCents: 80000 },
        { label: "Lazer", amountCents: 40000 },
      ],
    });

    expect(result[0].expenseCents).toBe(120000);
    expect(result[1].expenseCents).toBe(120000);
    expect(result[0].endBalanceCents).toBe(-120000);
    expect(result[1].endBalanceCents).toBe(-240000);
  });

  it("conta as parcelas já lançadas no mês em que caem", () => {
    const result = project({
      startingBalanceCents: 0,
      months: MESES,
      rules: [],
      scheduled: [
        { date: "2026-08-20", description: "TV", amount_cents: 30000, type: "expense", is_invoice_payment: false },
        { date: "2026-09-20", description: "TV", amount_cents: 30000, type: "expense", is_invoice_payment: false },
      ],
      plannedExpenses: [],
    });

    expect(result[0].expenseCents).toBe(30000);
    expect(result[1].expenseCents).toBe(30000);
    expect(result[2].expenseCents).toBe(0);
  });

  it("pagamento de fatura não conta de novo — a compra já foi contada", () => {
    const result = project({
      startingBalanceCents: 0,
      months: ["2026-08-01"],
      rules: [],
      scheduled: [
        { date: "2026-08-12", description: "Fatura Nubank", amount_cents: 234000, type: "expense", is_invoice_payment: true },
      ],
      plannedExpenses: [],
    });

    expect(result[0].expenseCents).toBe(0);
  });

  it("regra encerrada para de contar", () => {
    const result = project({
      startingBalanceCents: 0,
      months: MESES,
      rules: [{ ...aluguel, end_date: "2026-09-30" }],
      scheduled: [],
      plannedExpenses: [],
    });

    expect(result[0].expenseCents).toBe(250000);
    expect(result[1].expenseCents).toBe(250000);
    expect(result[2].expenseCents).toBe(0);
  });

  it("regra pausada não entra na projeção", () => {
    const result = project({
      startingBalanceCents: 0,
      months: ["2026-08-01"],
      rules: [{ ...aluguel, active: false }],
      scheduled: [],
      plannedExpenses: [],
    });
    expect(result[0].expenseCents).toBe(0);
  });

  it("lista os três maiores puxadores, somando parcelas do mesmo item", () => {
    const result = project({
      startingBalanceCents: 0,
      months: ["2026-08-01"],
      rules: [aluguel],
      scheduled: [
        { date: "2026-08-05", description: "TV", amount_cents: 30000, type: "expense", is_invoice_payment: false },
        { date: "2026-08-20", description: "TV", amount_cents: 30000, type: "expense", is_invoice_payment: false },
        { date: "2026-08-21", description: "Curso", amount_cents: 10000, type: "expense", is_invoice_payment: false },
        { date: "2026-08-22", description: "Livro", amount_cents: 5000, type: "expense", is_invoice_payment: false },
      ],
      plannedExpenses: [{ label: "Alimentação", amountCents: 80000 }],
    });

    expect(result[0].drivers).toEqual([
      { label: "Aluguel", amountCents: 250000 },
      { label: "Alimentação", amountCents: 80000 },
      { label: "TV", amountCents: 60000 },
    ]);
  });

  it("dívida de cartão em aberto entra pelo saldo inicial, não vira mês", () => {
    // Compras já feitas e não pagas não têm parcela futura que as represente;
    // se não saírem do saldo inicial, somem da projeção.
    const semDesconto = project({
      startingBalanceCents: 500000,
      months: ["2026-08-01"],
      rules: [],
      scheduled: [],
      plannedExpenses: [],
    });
    const comDesconto = project({
      startingBalanceCents: 500000 - 234000,
      months: ["2026-08-01"],
      rules: [],
      scheduled: [],
      plannedExpenses: [],
    });

    expect(semDesconto[0].endBalanceCents).toBe(500000);
    expect(comDesconto[0].endBalanceCents).toBe(266000);
  });
});

describe("variableAverage", () => {
  const base = {
    type: "expense" as const,
    recurring_id: null,
    installment_group_id: null,
    is_invoice_payment: false,
  };

  it("média sobre a quantidade de meses da janela, não sobre meses com gasto", () => {
    const average = variableAverage(
      [
        { ...base, date: "2026-05-10", amount_cents: 30000 },
        { ...base, date: "2026-06-10", amount_cents: 60000 },
        // julho sem gasto variável: ainda assim divide por 3
      ],
      ["2026-05-01", "2026-06-01", "2026-07-01"],
    );
    expect(average).toBe(30000);
  });

  it("ignora recorrente, parcela e pagamento de fatura", () => {
    const average = variableAverage(
      [
        { ...base, date: "2026-05-10", amount_cents: 10000 },
        { ...base, date: "2026-05-11", amount_cents: 999999, recurring_id: "r" },
        { ...base, date: "2026-05-12", amount_cents: 999999, installment_group_id: "g" },
        { ...base, date: "2026-05-13", amount_cents: 999999, is_invoice_payment: true },
      ],
      ["2026-05-01"],
    );
    expect(average).toBe(10000);
  });

  it("ignora receitas e meses fora da janela", () => {
    const average = variableAverage(
      [
        { ...base, date: "2026-05-10", amount_cents: 10000 },
        { ...base, date: "2026-05-11", amount_cents: 500000, type: "income" as const },
        { ...base, date: "2026-01-10", amount_cents: 500000 },
      ],
      ["2026-05-01"],
    );
    expect(average).toBe(10000);
  });

  it("janela vazia não divide por zero", () => {
    expect(variableAverage([], [])).toBe(0);
  });
});

describe("firstNegativeMonth", () => {
  it("aponta o primeiro mês em que falta dinheiro", () => {
    const result = project({
      startingBalanceCents: 300000,
      months: MESES,
      rules: [aluguel],
      scheduled: [],
      plannedExpenses: [],
    });
    // 3000 − 2500 = 500; −2500 = −2000 em setembro
    expect(firstNegativeMonth(result)).toBe("2026-09-01");
  });

  it("devolve null quando o saldo nunca fica negativo", () => {
    const result = project({
      startingBalanceCents: 1000000,
      months: MESES,
      rules: [salario],
      scheduled: [],
      plannedExpenses: [],
    });
    expect(firstNegativeMonth(result)).toBeNull();
  });
});
