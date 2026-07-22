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
import {
  getAccounts,
  getActiveRules,
  getCreditCards,
  getTransactions,
} from "@/lib/queries/request-cache";
import type { Transaction } from "@/types/database";

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
  const now = currentMonth();

  const averageWindow = monthSequence(addMonthsToMonth(now, -AVERAGE_WINDOW), addMonthsToMonth(now, -1));
  const futureMonths = monthSequence(
    addMonthsToMonth(now, 1),
    addMonthsToMonth(now, MONTHS_AHEAD),
  );

  const historyStart = monthRange(averageWindow[0]).start;
  const futureStart = monthRange(futureMonths[0]).start;

  const [accounts, transactions, rules, cards, budgetLines] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getActiveRules(),
    getCreditCards(),
    listBudgetLines(),
  ]);

  // Subconjuntos derivados em memória — antes eram queries separadas, todas
  // sobre a mesma tabela de transações já carregada aqui.
  const history = transactions.filter((t) => t.date >= historyStart);
  // Crédito fica de fora do agendado: as parcelas entram pelas faturas
  // (cardBills), no mês em que vencem — contá-las pela data seria duplicar.
  const scheduled = transactions.filter(
    (t) => t.date >= futureStart && t.payment_method !== "credito",
  );

  const delta = new Map<string, number>();
  for (const movement of transactions) {
    if (!movement.account_id || !movement.affects_balance) continue;
    delta.set(
      movement.account_id,
      (delta.get(movement.account_id) ?? 0) +
        (movement.type === "income" ? movement.amount_cents : -movement.amount_cents),
    );
  }
  const accountsBalanceCents = accounts
    .filter((account) => !account.archived)
    .reduce(
      (sum, account) => sum + account.initial_balance_cents + (delta.get(account.id) ?? 0),
      0,
    );

  // Faturas de cartão: cada uma vence num mês (invoice_month). A projeção
  // subtrai a fatura no mês em que vence, não tudo de uma vez no início.
  const byCard = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
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

  for (const card of cards) {
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

  const variableAverageCents = variableAverage(history, averageWindow);
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
    rules,
    scheduled,
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
