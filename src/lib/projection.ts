/**
 * Projeção de saldo para os próximos meses.
 *
 * O ponto de partida é o dinheiro que você realmente tem: saldo das contas
 * **menos** o que já deve no cartão. Sem esse desconto, compras já feitas e
 * ainda não pagas simplesmente sumiriam da projeção — elas aconteceram em
 * meses passados, então nenhuma parcela futura as representa.
 *
 * Daí para frente o regime é o mesmo do resto do app (competência, não caixa):
 * cada mês soma o que é previsto entrar e subtrai o que é previsto sair. Uma
 * compra no crédito conta no mês em que foi feita, e o pagamento da fatura não
 * conta de novo — senão o mesmo dinheiro sairia duas vezes.
 *
 * O que entra em cada mês:
 *   + recorrentes de receita ativas
 *   − recorrentes de despesa ativas
 *   − transações já lançadas com data naquele mês (parcelas, sobretudo)
 *   + receitas planejadas (linhas de orçamento de entrada)
 *   − custos planejados (linhas de orçamento de saída)
 */

import { monthOf, type DateStr, type MonthStr } from "./dates";
import { occurrenceDates, type RecurringRule } from "./recurring";
import type { Transaction, TxType } from "@/types/database";

export type ProjectionRule = RecurringRule & {
  description: string;
  amount_cents: number;
  type: TxType;
};

export type ScheduledTransaction = Pick<
  Transaction,
  "date" | "description" | "amount_cents" | "type" | "is_invoice_payment"
>;

export type ProjectionDriver = {
  label: string;
  amountCents: number;
};

/** Item mensal planejado — uma linha de orçamento (entrada ou saída). */
export type PlannedItem = {
  label: string;
  amountCents: number;
};

export type ProjectedMonth = {
  month: MonthStr;
  incomeCents: number;
  expenseCents: number;
  /** Resultado do mês: entradas − saídas. */
  netCents: number;
  /** Saldo acumulado ao fim do mês. Negativo = vai faltar dinheiro. */
  endBalanceCents: number;
  /** As três maiores saídas do mês, para explicar o número. */
  drivers: ProjectionDriver[];
};

export type ProjectionInput = {
  /** Saldo das contas menos o total ainda devido nas faturas. */
  startingBalanceCents: number;
  months: MonthStr[];
  rules: ProjectionRule[];
  /** Transações já gravadas com data futura — parcelas, principalmente. */
  scheduled: ScheduledTransaction[];
  /** Custos planejados que se repetem em todo mês projetado. */
  plannedExpenses: PlannedItem[];
  /** Receitas planejadas que se repetem em todo mês projetado. */
  plannedIncome?: PlannedItem[];
};

export function project({
  startingBalanceCents,
  months,
  rules,
  scheduled,
  plannedExpenses,
  plannedIncome = [],
}: ProjectionInput): ProjectedMonth[] {
  const scheduledByMonth = new Map<MonthStr, ScheduledTransaction[]>();
  for (const transaction of scheduled) {
    // Pagamento de fatura sairia em duplicidade: a compra já foi contada.
    if (transaction.is_invoice_payment) continue;
    const key = monthOf(transaction.date);
    const list = scheduledByMonth.get(key);
    if (list) list.push(transaction);
    else scheduledByMonth.set(key, [transaction]);
  }

  let balance = startingBalanceCents;

  return months.map((month) => {
    let incomeCents = 0;
    let expenseCents = 0;
    const drivers: ProjectionDriver[] = [];

    for (const rule of rules) {
      const occurrences = countOccurrencesIn(rule, month);
      if (occurrences === 0) continue;

      const amount = rule.amount_cents * occurrences;
      if (rule.type === "income") {
        incomeCents += amount;
      } else {
        expenseCents += amount;
        drivers.push({ label: rule.description, amountCents: amount });
      }
    }

    for (const transaction of scheduledByMonth.get(month) ?? []) {
      if (transaction.type === "income") {
        incomeCents += transaction.amount_cents;
      } else {
        expenseCents += transaction.amount_cents;
        drivers.push({
          label: transaction.description,
          amountCents: transaction.amount_cents,
        });
      }
    }

    for (const planned of plannedIncome) {
      if (planned.amountCents <= 0) continue;
      incomeCents += planned.amountCents;
    }

    for (const planned of plannedExpenses) {
      if (planned.amountCents <= 0) continue;
      expenseCents += planned.amountCents;
      drivers.push({ label: planned.label, amountCents: planned.amountCents });
    }

    const netCents = incomeCents - expenseCents;
    balance += netCents;

    return {
      month,
      incomeCents,
      expenseCents,
      netCents,
      endBalanceCents: balance,
      drivers: mergeDrivers(drivers).slice(0, 3),
    };
  });
}

/** Quantas vezes a regra cai neste mês (0 ou 1 — recorrência é mensal). */
function countOccurrencesIn(rule: ProjectionRule, month: MonthStr): number {
  return occurrenceDates(rule, month).filter((date) => monthOf(date) === month).length;
}

/** Parcelas do mesmo item aparecem uma vez só, somadas. */
function mergeDrivers(drivers: ProjectionDriver[]): ProjectionDriver[] {
  const merged = new Map<string, number>();
  for (const driver of drivers) {
    merged.set(driver.label, (merged.get(driver.label) ?? 0) + driver.amountCents);
  }
  return [...merged.entries()]
    .map(([label, amountCents]) => ({ label, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

/**
 * Média mensal de gasto variável: despesa que não é recorrente, não é parcela
 * e não é pagamento de fatura. É a parte imprevisível — e a única que a
 * projeção precisa estimar em vez de saber.
 */
export function variableAverage(
  transactions: Pick<
    Transaction,
    | "date"
    | "type"
    | "amount_cents"
    | "recurring_id"
    | "installment_group_id"
    | "is_invoice_payment"
  >[],
  months: MonthStr[],
): number {
  if (months.length === 0) return 0;

  const window = new Set(months);
  let total = 0;

  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    if (transaction.recurring_id) continue;
    if (transaction.installment_group_id) continue;
    if (transaction.is_invoice_payment) continue;
    if (!window.has(monthOf(transaction.date))) continue;
    total += transaction.amount_cents;
  }

  return Math.round(total / months.length);
}

/** Primeiro mês em que o saldo projetado fica negativo, se houver. */
export function firstNegativeMonth(projection: ProjectedMonth[]): MonthStr | null {
  return projection.find((month) => month.endBalanceCents < 0)?.month ?? null;
}

export type { DateStr };
