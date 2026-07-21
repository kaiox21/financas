import {
  addMonthsToMonth,
  currentMonth,
  monthRange,
  monthSequence,
  type MonthStr,
} from "@/lib/dates";
import { buildInvoices, usedLimitCents } from "@/lib/invoice-summary";
import {
  firstNegativeMonth,
  project,
  variableAverage,
  type ProjectedMonth,
} from "@/lib/projection";
import { budgetLineLabel, listBudgetLines, type BudgetLineView } from "@/lib/queries/budget";
import { createClient } from "@/lib/supabase/server";

export type ProjectionData = {
  months: ProjectedMonth[];
  startingBalanceCents: number;
  accountsBalanceCents: number;
  cardDebtCents: number;
  /** Total das linhas de orçamento aplicado a cada mês. */
  plannedTotalCents: number;
  budgetLines: BudgetLineView[];
  /** Média histórica de gasto variável — referência ao montar o orçamento. */
  variableAverageCents: number;
  averageWindow: MonthStr[];
  firstNegative: MonthStr | null;
};

const MONTHS_AHEAD = 6;
const AVERAGE_WINDOW = 3;

export async function loadProjection(): Promise<ProjectionData> {
  const supabase = await createClient();
  const now = currentMonth();

  const averageWindow = monthSequence(addMonthsToMonth(now, -AVERAGE_WINDOW), addMonthsToMonth(now, -1));
  const futureMonths = monthSequence(
    addMonthsToMonth(now, 1),
    addMonthsToMonth(now, MONTHS_AHEAD),
  );

  const historyStart = monthRange(averageWindow[0]).start;
  const futureStart = monthRange(futureMonths[0]).start;

  const [
    accounts,
    movements,
    rules,
    history,
    scheduled,
    cards,
    cardTransactions,
    budgetLines,
  ] = await Promise.all([
      supabase.from("accounts").select("id, initial_balance_cents, archived"),
      supabase
        .from("transactions")
        .select("account_id, type, amount_cents")
        .not("account_id", "is", null),
      supabase.from("recurring_transactions").select("*").eq("active", true),
      supabase
        .from("transactions")
        .select(
          "date, type, amount_cents, recurring_id, installment_group_id, is_invoice_payment",
        )
        .gte("date", historyStart),
      supabase
        .from("transactions")
        .select("date, description, amount_cents, type, is_invoice_payment")
        .gte("date", futureStart),
      supabase.from("credit_cards").select("*"),
      supabase
        .from("transactions")
        .select(
          "credit_card_id, type, amount_cents, invoice_month, payment_method, is_invoice_payment",
        )
        .not("credit_card_id", "is", null),
      listBudgetLines(),
    ]);

  for (const result of [
    accounts,
    movements,
    rules,
    history,
    scheduled,
    cards,
    cardTransactions,
  ]) {
    if (result.error) throw result.error;
  }

  const delta = new Map<string, number>();
  for (const movement of movements.data!) {
    if (!movement.account_id) continue;
    delta.set(
      movement.account_id,
      (delta.get(movement.account_id) ?? 0) +
        (movement.type === "income" ? movement.amount_cents : -movement.amount_cents),
    );
  }
  const accountsBalanceCents = accounts
    .data!.filter((account) => !account.archived)
    .reduce(
      (sum, account) => sum + account.initial_balance_cents + (delta.get(account.id) ?? 0),
      0,
    );

  // Dívida de cartão: compras já feitas que ainda não foram pagas. Elas
  // aconteceram no passado, então nenhum mês futuro as representa — precisam
  // sair do ponto de partida.
  const byCard = new Map<string, typeof cardTransactions.data>();
  for (const transaction of cardTransactions.data!) {
    if (!transaction.credit_card_id) continue;
    const list = byCard.get(transaction.credit_card_id);
    if (list) list.push(transaction);
    else byCard.set(transaction.credit_card_id, [transaction]);
  }
  const cardDebtCents = cards.data!.reduce((sum, card) => {
    const invoices = buildInvoices(
      byCard.get(card.id) ?? [],
      { closingDay: card.closing_day, dueDay: card.due_day },
      monthRange(now).end,
    );
    return sum + usedLimitCents(invoices);
  }, 0);

  const variableAverageCents = variableAverage(history.data!, averageWindow);
  const startingBalanceCents = accountsBalanceCents - cardDebtCents;

  const plannedExpenses = budgetLines.map((line) => ({
    label: budgetLineLabel(line),
    amountCents: line.amount_cents,
  }));
  const plannedTotalCents = plannedExpenses.reduce(
    (sum, planned) => sum + planned.amountCents,
    0,
  );

  const months = project({
    startingBalanceCents,
    months: futureMonths,
    rules: rules.data!,
    scheduled: scheduled.data!,
    plannedExpenses,
  });

  return {
    months,
    startingBalanceCents,
    accountsBalanceCents,
    cardDebtCents,
    plannedTotalCents,
    budgetLines,
    variableAverageCents,
    averageWindow,
    firstNegative: firstNegativeMonth(months),
  };
}
