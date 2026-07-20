import { describe, expect, it } from "vitest";

import { buildCategoryReport } from "./category-report";
import type { Category } from "@/types/database";

function category(id: string, name: string, parent_id: string | null = null): Category {
  return {
    id,
    user_id: "u",
    name,
    icon: "circle-dashed",
    color: "#ef4444",
    type: "expense",
    parent_id,
    is_default: false,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const expense = (cents: number, category_id: string | null) => ({
  type: "expense" as const,
  amount_cents: cents,
  category_id,
  is_invoice_payment: false,
});

const income = (cents: number, category_id: string | null) => ({
  type: "income" as const,
  amount_cents: cents,
  category_id,
  is_invoice_payment: false,
});

const invoicePayment = (cents: number) => ({
  type: "expense" as const,
  amount_cents: cents,
  category_id: null,
  is_invoice_payment: true,
});

const alimentacao = category("a", "Alimentação");
const mercado = category("a1", "Mercado", "a");
const restaurante = category("a2", "Restaurante", "a");
const transporte = category("t", "Transporte");

describe("buildCategoryReport", () => {
  it("mês sem gasto devolve relatório vazio", () => {
    expect(buildCategoryReport([], [])).toEqual({ totalCents: 0, slices: [] });
  });

  it("ordena por valor e calcula a fatia de cada uma", () => {
    const report = buildCategoryReport(
      [expense(30000, "a"), expense(10000, "t")],
      [alimentacao, transporte],
    );

    expect(report.totalCents).toBe(40000);
    expect(report.slices.map((s) => s.name)).toEqual(["Alimentação", "Transporte"]);
    expect(report.slices[0].share).toBeCloseTo(0.75);
    expect(report.slices[1].share).toBeCloseTo(0.25);
  });

  it("subcategoria soma na categoria pai e aparece detalhada dentro", () => {
    const report = buildCategoryReport(
      [expense(20000, "a1"), expense(5000, "a2"), expense(1000, "a")],
      [alimentacao, mercado, restaurante],
    );

    expect(report.slices).toHaveLength(1);
    expect(report.slices[0].name).toBe("Alimentação");
    expect(report.slices[0].amountCents).toBe(26000);
    expect(report.slices[0].children.map((c) => [c.name, c.amountCents])).toEqual([
      ["Mercado", 20000],
      ["Restaurante", 5000],
    ]);
  });

  it("ignora receitas", () => {
    const report = buildCategoryReport(
      [expense(10000, "a"), income(500000, "a")],
      [alimentacao],
    );
    expect(report.totalCents).toBe(10000);
  });

  it("ignora pagamento de fatura — a compra já contou no mês dela", () => {
    const report = buildCategoryReport(
      [expense(10000, "a"), invoicePayment(234000)],
      [alimentacao],
    );
    expect(report.totalCents).toBe(10000);
  });

  it("transação sem categoria vira 'Sem categoria'", () => {
    const report = buildCategoryReport([expense(10000, null)], []);
    expect(report.slices[0].name).toBe("Sem categoria");
    expect(report.slices[0].share).toBe(1);
  });

  it("o rabo longo vira 'Outras' para não passar de 7 classes coloridas", () => {
    const many = Array.from({ length: 10 }, (_, i) => category(`c${i}`, `Cat ${i}`));
    // 10 categorias, valores decrescentes: 1000, 900, ... 100
    const transactions = many.map((c, i) => expense(1000 - i * 100, c.id));

    const report = buildCategoryReport(transactions, many, { topN: 6 });

    expect(report.slices).toHaveLength(7);
    expect(report.slices.at(-1)!.name).toBe("Outras (4)");
    expect(report.slices.at(-1)!.amountCents).toBe(400 + 300 + 200 + 100);
    expect(report.slices.at(-1)!.children).toHaveLength(4);
  });

  it("não agrupa em 'Outras' quando sobra só uma — seria trocar seis por meia dúzia", () => {
    const many = Array.from({ length: 7 }, (_, i) => category(`c${i}`, `Cat ${i}`));
    const transactions = many.map((c, i) => expense(1000 - i * 100, c.id));

    const report = buildCategoryReport(transactions, many, { topN: 6 });

    expect(report.slices).toHaveLength(7);
    expect(report.slices.at(-1)!.name).toBe("Cat 6");
  });

  it("as fatias sempre somam o total", () => {
    const many = Array.from({ length: 12 }, (_, i) => category(`c${i}`, `Cat ${i}`));
    const transactions = many.map((c, i) => expense(1234 + i * 77, c.id));

    const report = buildCategoryReport(transactions, many, { topN: 6 });
    const sum = report.slices.reduce((total, slice) => total + slice.amountCents, 0);

    expect(sum).toBe(report.totalCents);
    expect(report.slices.reduce((t, s) => t + s.share, 0)).toBeCloseTo(1);
  });
});
