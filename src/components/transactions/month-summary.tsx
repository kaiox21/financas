import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MonthSummary as Summary } from "@/lib/queries/transactions";

export function MonthSummary({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <Tile
          label="Entrou"
          value={summary.incomeCents}
          icon={<ArrowUpRight className="size-3.5" />}
          tone="income"
        />
        <Tile
          label="Saiu"
          value={summary.expenseCents}
          icon={<ArrowDownLeft className="size-3.5" />}
          tone="expense"
        />
        <Tile label="Saldo" value={summary.balanceCents} tone="balance" />
      </div>

      {summary.invoicePaymentCents > 0 ? (
        <p className="text-muted-foreground text-xs">
          Mais {formatBRL(summary.invoicePaymentCents)} em pagamento de fatura — não
          entra em &ldquo;saiu&rdquo; porque a compra já foi contada no mês em que
          aconteceu.
        </p>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone: "income" | "expense" | "balance";
}) {
  const color =
    tone === "income"
      ? "text-emerald-600 dark:text-emerald-500"
      : tone === "expense"
        ? "text-destructive"
        : value < 0
          ? "text-destructive"
          : "text-foreground";

  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon}
        {label}
      </p>
      <p className={cn("mt-0.5 font-semibold tabular-nums", color)}>
        {formatBRL(value)}
      </p>
    </div>
  );
}
