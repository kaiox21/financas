import { describe, expect, it } from "vitest";

import { planReinstallment, type ParcelRow } from "./installments";

/** 3x de R$ 100,00 comprada em 10/03, faturas 04, 05 e 06. */
function threeParcels(): ParcelRow[] {
  return [
    {
      id: "p1",
      amount_cents: 10000,
      date: "2026-03-10",
      invoice_month: "2026-04-01",
      installment_number: 1,
    },
    {
      id: "p2",
      amount_cents: 10000,
      date: "2026-04-10",
      invoice_month: "2026-05-01",
      installment_number: 2,
    },
    {
      id: "p3",
      amount_cents: 10000,
      date: "2026-05-10",
      invoice_month: "2026-06-01",
      installment_number: 3,
    },
  ];
}

const plan = (args: Parameters<typeof planReinstallment>[0]) => {
  const result = planReinstallment(args);
  if (!result.ok) throw new Error(`esperava plano, veio erro: ${result.error}`);
  return result.plan;
};

describe("planReinstallment", () => {
  it("sem fatura paga, refaz a compra inteira preservando data e fatura originais", () => {
    const result = plan({
      parcels: threeParcels(),
      paidMonths: new Set(),
      newCount: 6,
      totalCents: 30000,
    });

    expect(result.lockedCount).toBe(0);
    expect(result.keepIds).toEqual([]);
    expect(result.deleteIds).toEqual(["p1", "p2", "p3"]);
    expect(result.create).toHaveLength(6);
    expect(result.installmentTotal).toBe(6);

    // Total preservado e redistribuído.
    expect(result.create.reduce((s, p) => s + p.amount_cents, 0)).toBe(30000);
    expect(result.create.every((p) => p.amount_cents === 5000)).toBe(true);

    // A 1ª parcela mantém a data e a fatura da compra original.
    expect(result.create[0].date).toBe("2026-03-10");
    expect(result.create[0].invoice_month).toBe("2026-04-01");
    // E a sequência continua mês a mês.
    expect(result.create[5].invoice_month).toBe("2026-09-01");
    expect(result.create[5].installment_number).toBe(6);
  });

  it("preserva as parcelas em fatura paga e só redistribui o que sobra", () => {
    const result = plan({
      parcels: threeParcels(),
      // Abril já foi pago: a 1ª parcela está travada.
      paidMonths: new Set(["2026-04-01"]),
      newCount: 5,
      totalCents: 30000,
    });

    expect(result.lockedCount).toBe(1);
    expect(result.lockedCents).toBe(10000);
    expect(result.keepIds).toEqual(["p1"]);
    expect(result.deleteIds).toEqual(["p2", "p3"]);

    // 4 novas parcelas dividindo os R$ 200,00 que restam.
    expect(result.create).toHaveLength(4);
    expect(result.create.reduce((s, p) => s + p.amount_cents, 0)).toBe(20000);
    expect(result.create.every((p) => p.amount_cents === 5000)).toBe(true);

    // A nova sequência começa no mês seguinte à última travada.
    expect(result.create[0].invoice_month).toBe("2026-05-01");
    expect(result.create[0].installment_number).toBe(2);
    expect(result.create[3].installment_number).toBe(5);
    expect(result.create.every((p) => p.installment_total === 5)).toBe(true);
  });

  it("trava até a última paga, mesmo com fatura adiantada no meio", () => {
    const result = plan({
      parcels: threeParcels(),
      // Pagou abril e junho, mas não maio: nada até junho pode ser reescrito.
      paidMonths: new Set(["2026-04-01", "2026-06-01"]),
      newCount: 5,
      totalCents: 30000,
    });

    expect(result.lockedCount).toBe(3);
    expect(result.keepIds).toEqual(["p1", "p2", "p3"]);
    expect(result.deleteIds).toEqual([]);
    expect(result.create).toHaveLength(2);
    expect(result.create[0].installment_number).toBe(4);
    expect(result.create[0].invoice_month).toBe("2026-07-01");
  });

  it("o resto de centavos cai na primeira parcela nova", () => {
    const result = plan({
      parcels: threeParcels(),
      paidMonths: new Set(),
      newCount: 3,
      totalCents: 10000,
    });

    expect(result.create.map((p) => p.amount_cents)).toEqual([3334, 3333, 3333]);
  });

  it("virar 1x limpa os campos de parcelamento", () => {
    const result = plan({
      parcels: threeParcels(),
      paidMonths: new Set(),
      newCount: 1,
      totalCents: 30000,
    });

    expect(result.installmentTotal).toBeNull();
    expect(result.create).toHaveLength(1);
    expect(result.create[0].amount_cents).toBe(30000);
    expect(result.create[0].installment_number).toBeNull();
    expect(result.create[0].installment_total).toBeNull();
  });

  it("aumentar o total mantém as travadas e joga a diferença nas novas", () => {
    const result = plan({
      parcels: threeParcels(),
      paidMonths: new Set(["2026-04-01"]),
      newCount: 3,
      totalCents: 50000,
    });

    // R$ 500 − R$ 100 já pagos = R$ 400 em 2 parcelas.
    expect(result.create).toHaveLength(2);
    expect(result.create.every((p) => p.amount_cents === 20000)).toBe(true);
  });

  it("recusa reduzir abaixo do que já foi pago", () => {
    const result = planReinstallment({
      parcels: threeParcels(),
      paidMonths: new Set(["2026-04-01", "2026-05-01"]),
      newCount: 1,
      totalCents: 30000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("faturas pagas");
  });

  it("recusa total menor do que já foi quitado", () => {
    const result = planReinstallment({
      parcels: threeParcels(),
      paidMonths: new Set(["2026-04-01", "2026-05-01"]),
      newCount: 3,
      totalCents: 15000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("menor");
  });

  it("recusa deixar valor sem parcela para receber", () => {
    const result = planReinstallment({
      parcels: threeParcels(),
      paidMonths: new Set(["2026-04-01"]),
      // Só a travada sobreviveria, mas ainda restam R$ 200 sem destino.
      newCount: 1,
      totalCents: 30000,
    });

    expect(result.ok).toBe(false);
  });

  it("mantém tudo quando as travadas já cobrem o total exato", () => {
    const result = plan({
      parcels: threeParcels(),
      paidMonths: new Set(["2026-04-01"]),
      newCount: 1,
      totalCents: 10000,
    });

    expect(result.keepIds).toEqual(["p1"]);
    expect(result.deleteIds).toEqual(["p2", "p3"]);
    expect(result.create).toEqual([]);
    expect(result.installmentTotal).toBeNull();
  });
});
