import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addMonthsToMonth, currentMonth, formatMonthLong, type MonthStr } from "@/lib/dates";

export function MonthNav({ month }: { month: MonthStr }) {
  const previous = addMonthsToMonth(month, -1);
  const next = addMonthsToMonth(month, 1);
  const isCurrent = month === currentMonth();

  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" aria-label="Mês anterior" render={<Link href={`/transacoes?mes=${previous}`} />}>
        <ChevronLeft />
      </Button>

      <div className="text-center">
        <p className="font-medium capitalize">{formatMonthLong(month)}</p>
        {isCurrent ? null : (
          <Link
            href="/transacoes"
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
          >
            voltar para o mês atual
          </Link>
        )}
      </div>

      <Button variant="ghost" size="icon" aria-label="Próximo mês" render={<Link href={`/transacoes?mes=${next}`} />}>
        <ChevronRight />
      </Button>
    </div>
  );
}
