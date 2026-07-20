import { describe, expect, it } from "vitest";

import { byType, netWorth, withReturns } from "./investment-summary";
import type { Investment } from "@/types/database";

function investment(
  id: string,
  name: string,
  current_value_cents: number,
  type: Investment["type"] = "renda_fixa",
): Investment {
  return {
    id,
    user_id: "u",
    name,
    type,
    current_value_cents,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const aporte = (investment_id: string, cents: number) => ({
  investment_id,
  amount_cents: cents,
  type: "expense" as const,
});

describe("withReturns", () => {
  it("rendimento é o valor atual menos o aportado", () => {
    const [result] = withReturns(
      [investment("i", "CDB", 110000)],
      [aporte("i", 50000), aporte("i", 50000)],
    );

    expect(result.contributedCents).toBe(100000);
    expect(result.returnCents).toBe(10000);
    expect(result.returnRate).toBeCloseTo(0.1);
  });

  it("prejuízo aparece como rendimento negativo", () => {
    const [result] = withReturns(
      [investment("i", "Ações", 80000, "renda_variavel")],
      [aporte("i", 100000)],
    );
    expect(result.returnCents).toBe(-20000);
    expect(result.returnRate).toBeCloseTo(-0.2);
  });

  it("sem aporte não há taxa a calcular — não divide por zero", () => {
    const [result] = withReturns([investment("i", "Herança", 500000)], []);
    expect(result.contributedCents).toBe(0);
    expect(result.returnRate).toBeNull();
    expect(result.returnCents).toBe(500000);
  });

  it("aporte de outro investimento não vaza", () => {
    const [a, b] = withReturns(
      [investment("a", "CDB", 10000), investment("b", "Tesouro", 20000)],
      [aporte("a", 5000), aporte("b", 15000)],
    );
    expect(a.contributedCents).toBe(5000);
    expect(b.contributedCents).toBe(15000);
  });
});

describe("netWorth", () => {
  it("soma contas e investimentos", () => {
    const investments = withReturns(
      [investment("i", "CDB", 110000)],
      [aporte("i", 100000)],
    );
    const result = netWorth([250000, -30000], investments);

    expect(result.accountsCents).toBe(220000);
    expect(result.investedCents).toBe(110000);
    expect(result.returnCents).toBe(10000);
    expect(result.totalCents).toBe(330000);
  });

  it("sem nada, tudo é zero", () => {
    expect(netWorth([], [])).toEqual({
      accountsCents: 0,
      investedCents: 0,
      contributedCents: 0,
      returnCents: 0,
      totalCents: 0,
    });
  });
});

describe("byType", () => {
  it("agrupa por tipo e calcula a fatia", () => {
    const investments = withReturns(
      [
        investment("a", "CDB", 60000, "renda_fixa"),
        investment("b", "Tesouro", 20000, "renda_fixa"),
        investment("c", "Ações", 20000, "renda_variavel"),
      ],
      [],
    );

    const groups = byType(investments);
    expect(groups.map((g) => [g.label, g.valueCents])).toEqual([
      ["Renda fixa", 80000],
      ["Renda variável", 20000],
    ]);
    expect(groups[0].share).toBeCloseTo(0.8);
  });

  it("carteira zerada não vira divisão por zero", () => {
    expect(byType(withReturns([investment("a", "CDB", 0)], []))).toEqual([]);
  });
});
