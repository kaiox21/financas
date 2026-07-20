import { describe, expect, it } from "vitest";

import { monthlySeries } from "./monthly-series";

const tx = (
  date: string,
  type: "income" | "expense",
  amount_cents: number,
  is_invoice_payment = false,
) => ({ date, type, amount_cents, is_invoice_payment });

describe("monthlySeries", () => {
  it("meses sem movimento aparecem zerados, não somem do eixo", () => {
    const series = monthlySeries([tx("2026-03-10", "income", 100)], "2026-01-01", "2026-04-01");

    expect(series.map((p) => p.month)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
    ]);
    expect(series[0].incomeCents).toBe(0);
    expect(series[2].incomeCents).toBe(100);
  });

  it("separa entradas de saídas e calcula o saldo", () => {
    const [point] = monthlySeries(
      [
        tx("2026-03-05", "income", 500000),
        tx("2026-03-10", "expense", 120000),
        tx("2026-03-20", "expense", 30000),
      ],
      "2026-03-01",
      "2026-03-01",
    );

    expect(point.incomeCents).toBe(500000);
    expect(point.expenseCents).toBe(150000);
    expect(point.balanceCents).toBe(350000);
  });

  it("pagamento de fatura não conta como saída", () => {
    const [point] = monthlySeries(
      [tx("2026-03-10", "expense", 20000), tx("2026-03-12", "expense", 234000, true)],
      "2026-03-01",
      "2026-03-01",
    );
    expect(point.expenseCents).toBe(20000);
  });

  it("ignora transações fora da janela", () => {
    const series = monthlySeries(
      [tx("2025-12-31", "income", 999), tx("2026-02-01", "income", 100)],
      "2026-01-01",
      "2026-02-01",
    );
    expect(series.reduce((sum, p) => sum + p.incomeCents, 0)).toBe(100);
  });

  it("janela de um mês só devolve um ponto", () => {
    expect(monthlySeries([], "2026-03-01", "2026-03-01")).toHaveLength(1);
  });
});
