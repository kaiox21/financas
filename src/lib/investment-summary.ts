/**
 * Patrimônio = o que está nas contas + o que está investido.
 *
 * O valor atual de um investimento é informado por você (não há cotação
 * automática, por design). O quanto você colocou nele é derivado dos aportes —
 * transações de saída com `investment_id`. A diferença entre os dois é o
 * rendimento.
 */

import type { Investment, InvestmentType, Transaction } from "@/types/database";

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  renda_fixa: "Renda fixa",
  renda_variavel: "Renda variável",
  reserva: "Reserva de emergência",
};

/**
 * Cor fixa por tipo — nunca pela posição no ranking. Se a cor seguisse a
 * ordem, um tipo passar o outro repintaria os dois e a leitura mudaria sem
 * que nada de fato tivesse mudado.
 *
 * Trio validado: pior par tem ΔE 14.5 em deuteranopia e 21.6 em visão normal.
 */
export const INVESTMENT_TYPE_COLORS: Record<InvestmentType, string> = {
  renda_fixa: "#0ea5e9",
  renda_variavel: "#f43f5e",
  reserva: "#f59e0b",
};

export type InvestmentWithReturn = Investment & {
  /** Soma dos aportes registrados. */
  contributedCents: number;
  /** Valor atual − aportado. Negativo é prejuízo. */
  returnCents: number;
  /** Rendimento sobre o aportado, 0.1 = 10%. `null` quando nada foi aportado. */
  returnRate: number | null;
};

type ContributionInput = Pick<Transaction, "investment_id" | "amount_cents" | "type">;

export function withReturns(
  investments: Investment[],
  contributions: ContributionInput[],
): InvestmentWithReturn[] {
  const contributed = new Map<string, number>();

  for (const transaction of contributions) {
    if (!transaction.investment_id || transaction.type !== "expense") continue;
    contributed.set(
      transaction.investment_id,
      (contributed.get(transaction.investment_id) ?? 0) + transaction.amount_cents,
    );
  }

  return investments.map((investment) => {
    const contributedCents = contributed.get(investment.id) ?? 0;
    const returnCents = investment.current_value_cents - contributedCents;

    return {
      ...investment,
      contributedCents,
      returnCents,
      returnRate: contributedCents > 0 ? returnCents / contributedCents : null,
    };
  });
}

export type NetWorth = {
  accountsCents: number;
  investedCents: number;
  contributedCents: number;
  returnCents: number;
  totalCents: number;
};

export function netWorth(
  accountBalancesCents: number[],
  investments: InvestmentWithReturn[],
): NetWorth {
  const accountsCents = accountBalancesCents.reduce((sum, value) => sum + value, 0);
  const investedCents = investments.reduce(
    (sum, investment) => sum + investment.current_value_cents,
    0,
  );
  const contributedCents = investments.reduce(
    (sum, investment) => sum + investment.contributedCents,
    0,
  );

  return {
    accountsCents,
    investedCents,
    contributedCents,
    returnCents: investedCents - contributedCents,
    totalCents: accountsCents + investedCents,
  };
}

/** Agrupa por tipo, para a divisão do patrimônio investido. */
export function byType(
  investments: InvestmentWithReturn[],
): { type: InvestmentType; label: string; valueCents: number; share: number }[] {
  const total = investments.reduce(
    (sum, investment) => sum + investment.current_value_cents,
    0,
  );
  if (total === 0) return [];

  const totals = new Map<InvestmentType, number>();
  for (const investment of investments) {
    totals.set(
      investment.type,
      (totals.get(investment.type) ?? 0) + investment.current_value_cents,
    );
  }

  return [...totals.entries()]
    .map(([type, valueCents]) => ({
      type,
      label: INVESTMENT_TYPE_LABELS[type],
      valueCents,
      share: valueCents / total,
    }))
    .sort((a, b) => b.valueCents - a.valueCents);
}
