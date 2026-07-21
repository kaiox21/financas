import { buildCategoryReport, type CategoryReport } from "@/lib/category-report";
import { addMonthsToMonth, currentMonth, monthRange, type MonthStr } from "@/lib/dates";
import { withReturns } from "@/lib/investment-summary";
import { monthlySeries, type MonthPoint } from "@/lib/monthly-series";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const month = currentMonth();
  const from = addMonthsToMonth(month, -MONTHS_BACK);
  const windowStart = monthRange(from).start;
  const monthBounds = monthRange(month);

  const [accounts, movements, windowTransactions, categories, investments, contributions] =
    await Promise.all([
      supabase.from("accounts").select("id, initial_balance_cents, archived"),
      supabase
        .from("transactions")
        .select("account_id, type, amount_cents")
        .not("account_id", "is", null)
        .eq("affects_balance", true),
      supabase
        .from("transactions")
        .select("*")
        .gte("date", windowStart)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*"),
      supabase.from("investments").select("*"),
      supabase
        .from("transactions")
        .select("investment_id, amount_cents, type")
        .not("investment_id", "is", null),
    ]);

  for (const result of [
    accounts,
    movements,
    windowTransactions,
    categories,
    investments,
    contributions,
  ]) {
    if (result.error) throw result.error;
  }

  // Saldo das contas ativas: inicial + entradas − saídas.
  const delta = new Map<string, number>();
  for (const movement of movements.data!) {
    if (!movement.account_id) continue;
    const signed =
      movement.type === "income" ? movement.amount_cents : -movement.amount_cents;
    delta.set(movement.account_id, (delta.get(movement.account_id) ?? 0) + signed);
  }
  const accountsBalanceCents = accounts
    .data!.filter((account) => !account.archived)
    .reduce(
      (sum, account) =>
        sum + account.initial_balance_cents + (delta.get(account.id) ?? 0),
      0,
    );

  const investedCents = withReturns(investments.data!, contributions.data!).reduce(
    (sum, investment) => sum + investment.current_value_cents,
    0,
  );

  const all = windowTransactions.data!;
  const ofMonth = all.filter(
    (transaction) =>
      transaction.date >= monthBounds.start && transaction.date <= monthBounds.end,
  );
  const categoryById = new Map(categories.data!.map((c) => [c.id, c]));

  return {
    month,
    accountsBalanceCents,
    investedCents,
    netWorthCents: accountsBalanceCents + investedCents,
    summary: summarize(ofMonth),
    series: monthlySeries(all, from, month),
    report: buildCategoryReport(ofMonth, categories.data!, { topN: 5 }),
    recent: all.slice(0, 5).map((transaction) => ({
      ...transaction,
      category: transaction.category_id
        ? (categoryById.get(transaction.category_id) ?? null)
        : null,
    })),
  };
}
