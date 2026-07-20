import type { Metadata } from "next";

import { MonthNav } from "@/components/transactions/month-nav";
import { MonthSummary } from "@/components/transactions/month-summary";
import { TransactionsView } from "@/components/transactions/transactions-view";
import { currentMonth, monthOf, isValidDate, type MonthStr } from "@/lib/dates";
import { listActiveAccountsAndCards } from "@/lib/queries/accounts";
import { listCategories } from "@/lib/queries/categories";
import { lastPaymentMethod, listTransactionsByMonth } from "@/lib/queries/transactions";

export const metadata: Metadata = { title: "Transações" };

/** `?mes=YYYY-MM-01`; qualquer coisa inválida cai no mês atual. */
function resolveMonth(raw: string | undefined): MonthStr {
  if (!raw || !isValidDate(raw)) return currentMonth();
  return monthOf(raw);
}

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const month = resolveMonth((await searchParams).mes);

  const [{ transactions, summary }, categories, sources, defaultPaymentMethod] =
    await Promise.all([
      listTransactionsByMonth(month),
      listCategories(),
      listActiveAccountsAndCards(),
      lastPaymentMethod(),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <MonthNav month={month} />
      <MonthSummary summary={summary} />
      <TransactionsView
        transactions={transactions}
        formData={{
          categories,
          accounts: sources.accounts,
          cards: sources.cards,
          defaultPaymentMethod,
        }}
      />
    </div>
  );
}
