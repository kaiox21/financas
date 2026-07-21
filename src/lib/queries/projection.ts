import {
  addMonthsToMonth,
  currentMonth,
  monthRange,
  monthSequence,
  type MonthStr,
} from "@/lib/dates";
import { buildInvoices } from "@/lib/invoice-summary";
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
  /** Faturas já vencidas/deste mês, descontadas do que você tem hoje. */
  immediateBillsCents: number;
  /** Total das faturas futuras espalhadas pelos meses da projeção. */
  futureBillsCents: number;
  /** Total das saídas planejadas aplicado a cada mês. */
  plannedExpenseCents: number;
  /** Total das entradas planejadas aplicado a cada mês. */
  plannedIncomeCents: number;
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
        .not("account_id", "is", null)
        .eq("affects_balance", true),
      supabase.from("recurring_transactions").select("*").eq("active", true),
      supabase
        .from("transactions")
        .select(
          "date, type, amount_cents, recurring_id, installment_group_id, is_invoice_payment",
        )
        .gte("date", historyStart),
      supabase
        .from("transactions")
        .select(
          "date, description, amount_cents, type, is_invoice_payment, payment_method",
        )
        .gte("date", futureStart)
        // Crédito fica de fora: as parcelas entram pelas faturas (cardBills),
        // no mês em que vencem — contá-las pela data seria duplicar.
        .neq("payment_method", "credito"),
      supabase.from("credit_cards").select("*"),
      supabase
        .from("transactions")
        .select(
          "credit_card_id, type, amount_cents, invoice_month, payment_method, is_invoice_payment, affects_balance",
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

  // Faturas de cartão: cada uma vence num mês (invoice_month). A projeção
  // subtrai a fatura no mês em que vence, não tudo de uma vez no início.
  const byCard = new Map<string, typeof cardTransactions.data>();
  for (const transaction of cardTransactions.data!) {
    if (!transaction.credit_card_id) continue;
    const list = byCard.get(transaction.credit_card_id);
    if (list) list.push(transaction);
    else byCard.set(transaction.credit_card_id, [transaction]);
  }

  const futureSet = new Set(futureMonths);
  const cardBills: { month: MonthStr; label: string; amountCents: number }[] = [];
  // Faturas já vencidas ou que vencem ainda este mês (antes do 1º mês
  // projetado) já são compromisso imediato: saem do que você tem hoje.
  let immediateBillsCents = 0;

  for (const card of cards.data!) {
    const invoices = buildInvoices(
      byCard.get(card.id) ?? [],
      { closingDay: card.closing_day, dueDay: card.due_day },
      monthRange(now).end,
    );
    for (const invoice of invoices) {
      if (invoice.outstandingCents <= 0) continue;
      if (futureSet.has(invoice.month)) {
        cardBills.push({
          month: invoice.month,
          label: `Fatura ${card.name}`,
          amountCents: invoice.outstandingCents,
        });
      } else if (invoice.month <= now) {
        immediateBillsCents += invoice.outstandingCents;
      }
      // Faturas além da janela de projeção ficam de fora.
    }
  }

  const variableAverageCents = variableAverage(history.data!, averageWindow);
  const startingBalanceCents = accountsBalanceCents - immediateBillsCents;

  const toPlanned = (line: BudgetLineView) => ({
    label: budgetLineLabel(line),
    amountCents: line.amount_cents,
  });
  const plannedExpenses = budgetLines
    .filter((line) => line.type === "expense")
    .map(toPlanned);
  const plannedIncome = budgetLines
    .filter((line) => line.type === "income")
    .map(toPlanned);

  const sum = (items: { amountCents: number }[]) =>
    items.reduce((total, item) => total + item.amountCents, 0);

  const months = project({
    startingBalanceCents,
    months: futureMonths,
    rules: rules.data!,
    scheduled: scheduled.data!,
    cardBills,
    plannedExpenses,
    plannedIncome,
  });

  return {
    months,
    startingBalanceCents,
    accountsBalanceCents,
    immediateBillsCents,
    futureBillsCents: sum(cardBills),
    plannedExpenseCents: sum(plannedExpenses),
    plannedIncomeCents: sum(plannedIncome),
    budgetLines,
    variableAverageCents,
    averageWindow,
    firstNegative: firstNegativeMonth(months),
  };
}
