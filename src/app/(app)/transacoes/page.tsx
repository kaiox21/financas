import type { Metadata } from "next";
import Link from "next/link";
import { ChartPie, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MonthNav } from "@/components/transactions/month-nav";
import { MonthSummary } from "@/components/transactions/month-summary";
import { TransactionsView } from "@/components/transactions/transactions-view";
import { currentMonth, monthOf, isValidDate, type MonthStr } from "@/lib/dates";
import { listActiveAccountsAndCards } from "@/lib/queries/accounts";
import { listCategories } from "@/lib/queries/categories";
import { materializeRecurring } from "@/lib/queries/materialize";
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

  // Repetível: só cria o que falta. Rodar antes de listar garante que as
  // recorrentes do mês já apareçam na primeira visita do mês.
  await materializeRecurring();

  const [{ transactions, summary }, categories, sources, defaultPaymentMethod] =
    await Promise.all([
      listTransactionsByMonth(month),
      listCategories(),
      listActiveAccountsAndCards(),
      lastPaymentMethod(),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/transacoes/relatorio?mes=${month}`} />}
        >
          <ChartPie />
          Por categoria
        </Button>
        <Button variant="outline" size="sm" render={<Link href="/transacoes/recorrentes" />}>
          <Repeat />
          Recorrentes
        </Button>
      </div>

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
