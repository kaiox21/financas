"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateBR, formatMonthLong } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/invoice-summary";
import type { CardWithInvoices } from "@/lib/queries/invoices";

export function CardInvoicesDialog({
  card,
  open,
  onOpenChange,
  onPay,
}: {
  card: CardWithInvoices;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: (invoice: Invoice) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Faturas · {card.name}</DialogTitle>
          <DialogDescription>
            Fecha dia {card.closing_day}, vence dia {card.due_day}. Cada fatura é
            identificada pelo mês em que vence.
          </DialogDescription>
        </DialogHeader>

        {card.invoices.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">
            Nenhuma compra neste cartão ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {card.invoices.map((invoice) => (
              <li
                key={invoice.month}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium capitalize">
                    {formatMonthLong(invoice.month)}
                    <StatusBadge invoice={invoice} />
                  </p>
                  <p className="text-muted-foreground text-xs">
                    fecha {formatDateBR(invoice.closingDate)} · vence{" "}
                    {formatDateBR(invoice.dueDate)}
                  </p>
                  {invoice.paidCents > 0 && !invoice.isPaid ? (
                    <p className="text-muted-foreground text-xs">
                      pago {formatBRL(invoice.paidCents)} de{" "}
                      {formatBRL(invoice.totalCents)}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {formatBRL(
                      invoice.isPaid ? invoice.totalCents : invoice.outstandingCents,
                    )}
                  </span>
                  {invoice.isPaid ? null : (
                    <Button size="sm" variant="outline" onClick={() => onPay(invoice)}>
                      Pagar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ invoice }: { invoice: Invoice }) {
  const label = invoice.isPaid ? "paga" : invoice.isOpen ? "aberta" : "fechada";
  return (
    <span
      className={cn(
        "ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium",
        invoice.isPaid
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : invoice.isOpen
            ? "bg-muted text-muted-foreground"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      )}
    >
      {label}
    </span>
  );
}
