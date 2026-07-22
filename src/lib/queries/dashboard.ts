import { buildCategoryReport, type CategoryReport } from "@/lib/category-report";
import { addMonthsToMonth, currentMonth, monthRange, type MonthStr } from "@/lib/dates";
import { withReturns } from "@/lib/investment-summary";
import { monthlySeries, type MonthPoint } from "@/lib/monthly-series";
import {
  getAccounts,
  getCategories,
  getInvestments,
  getTransactions,
} from "@/lib/queries/request-cache";
import { summarize, type MonthSummary } from "@/lib/summary";
import type { Category, Transaction } from "@/types/database";

export type DashboardData = {
  month: MonthStr;
  accountsBalanceCents: number;
  investedCents: number;
  netWorthCents: number;
  summary: MonthSummary;
  series: MonthPoint[];
  report: CategoryReport;
  recent: (Transaction & { category: Category | null })[];
};

const MONTHS_BACK = 5; // 6 meses no total, contando o corrente

export async function loadDashboard(): Promise<DashboardData> {
  const month = currentMonth();
  const from = addMonthsToMonth(month, -MONTHS_BACK);
  const windowStart = monthRange(from).start;
  const monthBounds = monthRange(month);

  const [accounts, transactions, categories, investments] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getCategories(),
    getInvestments(),
  ]);

  // Saldo das contas ativas: inicial + entradas − saídas.
  // Compras no crédito têm account_id nulo; pagamentos históricos entram como
  // affects_balance=false — ambos ficam de fora do delta.
  const delta = new Map<string, number>();
  for (const movement of transactions) {
    if (!movement.account_id || !movement.affects_balance) continue;
    const signed =
      movement.type === "income" ? movement.amount_cents : -movement.amount_cents;
    delta.set(movement.account_id, (delta.get(movement.account_id) ?? 0) + signed);
  }
  const accountsBalanceCents = accounts
    .filter((account) => !account.archived)
    .reduce(
      (sum, account) =>
        sum + account.initial_balance_cents + (delta.get(account.id) ?? 0),
      0,
    );

  const contributions = transactions.filter((t) => t.investment_id);
  const investedCents = withReturns(investments, contributions).reduce(
    (sum, investment) => sum + investment.current_value_cents,
    0,
  );

  const all = transactions.filter((transaction) => transaction.date >= windowStart);
  const ofMonth = all.filter(
    (transaction) =>
      transaction.date >= monthBounds.start && transaction.date <= monthBounds.end,
  );
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return {
    month,
    accountsBalanceCents,
    investedCents,
    netWorthCents: accountsBalanceCents + investedCents,
    summary: summarize(ofMonth),
    series: monthlySeries(all, from, month),
    report: buildCategoryReport(ofMonth, categories, { topN: 5 }),
    recent: all.slice(0, 5).map((transaction) => ({
      ...transaction,
      category: transaction.category_id
        ? (categoryById.get(transaction.category_id) ?? null)
        : null,
    })),
  };
}
