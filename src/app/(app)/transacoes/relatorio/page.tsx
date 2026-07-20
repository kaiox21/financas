import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { CategoryBreakdown } from "@/components/reports/category-breakdown";
import { Button } from "@/components/ui/button";
import { buildCategoryReport } from "@/lib/category-report";
import {
  addMonthsToMonth,
  currentMonth,
  formatMonthLong,
  isValidDate,
  monthOf,
  type MonthStr,
} from "@/lib/dates";
import { listCategories } from "@/lib/queries/categories";
import { listTransactionsByMonth } from "@/lib/queries/transactions";

export const metadata: Metadata = { title: "Gastos por categoria" };

function resolveMonth(raw: string | undefined): MonthStr {
  if (!raw || !isValidDate(raw)) return currentMonth();
  return monthOf(raw);
}

export default async function RelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const month = resolveMonth((await searchParams).mes);

  const [{ transactions }, categories] = await Promise.all([
    listTransactionsByMonth(month),
    listCategories(),
  ]);

  const report = buildCategoryReport(transactions, categories);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-2"
        render={<Link href={`/transacoes?mes=${month}`} />}
      >
        <ChevronLeft />
        Transações
      </Button>

      <PageHeader
        title="Gastos por categoria"
        description="Só despesas. Pagamento de fatura não entra — a compra já contou no mês em que aconteceu."
      />

      <div className="mb-6 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          render={<Link href={`/transacoes/relatorio?mes=${addMonthsToMonth(month, -1)}`} />}
        >
          <ChevronLeft />
        </Button>
        <p className="font-medium capitalize">{formatMonthLong(month)}</p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          render={<Link href={`/transacoes/relatorio?mes=${addMonthsToMonth(month, 1)}`} />}
        >
          <ChevronRight />
        </Button>
      </div>

      <CategoryBreakdown report={report} />
    </>
  );
}
