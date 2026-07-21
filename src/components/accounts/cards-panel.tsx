"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteCreditCard, setCreditCardArchived } from "@/actions/credit-cards";
import {
  setInvoiceHistorical,
  settleClosedInvoicesHistorical,
} from "@/actions/invoices";
import { CardDialog, useCardDialog } from "@/components/accounts/card-dialog";
import { CardInvoicesDialog } from "@/components/accounts/card-invoices-dialog";
import { PayInvoiceDialog } from "@/components/accounts/pay-invoice-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/invoice-summary";
import type { CardWithInvoices } from "@/lib/queries/invoices";
import type { Account } from "@/types/database";

export function CardsPanel({
  cards,
  accounts,
}: {
  cards: CardWithInvoices[];
  accounts: Account[];
}) {
  const dialog = useCardDialog();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invoicesForId, setInvoicesForId] = useState<string | null>(null);
  // Deriva da lista viva para o diálogo refletir mudanças após revalidação.
  const invoicesFor = cards.find((card) => card.id === invoicesForId) ?? null;
  const [paying, setPaying] = useState<{
    card: CardWithInvoices;
    invoice: Invoice;
  } | null>(null);

  const active = cards.filter((card) => !card.archived);
  const archived = cards.filter((card) => card.archived);

  function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        toast.error("Algo deu errado. Tente de novo.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={dialog.openNew}>
          <Plus />
          Novo cartão
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum cartão ainda. Sem cartão, lançamentos no crédito ficam indisponíveis.
          </p>
          <Button onClick={dialog.openNew}>
            <Plus />
            Novo cartão
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...active, ...archived].map((card) => (
            <li
              key={card.id}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-4",
                card.archived && "opacity-60",
                busyId === card.id && pending && "animate-pulse",
              )}
            >
              <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {card.name}
                  {card.archived ? (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      arquivado
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-sm tabular-nums">
                  fecha dia {card.closing_day} · vence dia {card.due_day}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label="Ações do cartão" />
                  }
                >
                  <MoreVertical />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => dialog.openEdit(card)}>
                    <Pencil />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      run(card.id, async () => {
                        await setCreditCardArchived(card.id, !card.archived);
                        toast.success(
                          card.archived ? "Cartão reativado." : "Cartão arquivado.",
                        );
                      })
                    }
                  >
                    {card.archived ? <ArchiveRestore /> : <Archive />}
                    {card.archived ? "Reativar" : "Arquivar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      run(card.id, async () => {
                        const result = await deleteCreditCard(card.id);
                        if (result.error) toast.error(result.error);
                        else toast.success("Cartão excluído.");
                      })
                    }
                  >
                    <Trash2 />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>

              <CardLimit card={card} />

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  {card.openInvoice ? (
                    <p className="truncate">
                      Fatura aberta:{" "}
                      <span className="font-medium tabular-nums">
                        {formatBRL(card.openInvoice.totalCents)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · vence {formatDateBR(card.openInvoice.dueDate)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Nenhuma compra em aberto.</p>
                  )}
                  {card.nextDueInvoice ? (
                    <p className="text-amber-700 dark:text-amber-400">
                      Fatura fechada a pagar:{" "}
                      {formatBRL(card.nextDueInvoice.outstandingCents)} · vence{" "}
                      {formatDateBR(card.nextDueInvoice.dueDate)}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setInvoicesForId(card.id)}
                  >
                    Faturas
                  </Button>
                  {card.nextDueInvoice ?? card.openInvoice ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        setPaying({
                          card,
                          invoice: card.nextDueInvoice ?? card.openInvoice!,
                        })
                      }
                    >
                      Pagar
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CardDialog
        key={dialog.card?.id ?? "new"}
        card={dialog.card}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
      />

      {invoicesFor ? (
        <CardInvoicesDialog
          key={`invoices-${invoicesFor.id}`}
          card={invoicesFor}
          open
          onOpenChange={(next) => {
            if (!next) setInvoicesForId(null);
          }}
          onPay={(invoice) => {
            setInvoicesForId(null);
            setPaying({ card: invoicesFor, invoice });
          }}
          pending={pending}
          onSettleClosed={() =>
            run(invoicesFor.id, async () => {
              const result = await settleClosedInvoicesHistorical(invoicesFor.id);
              if (result.error) toast.error(result.error);
              else toast.success("Faturas fechadas quitadas (histórico).");
            })
          }
          onToggleHistorical={(invoiceMonth, historical) =>
            run(invoicesFor.id, async () => {
              const result = await setInvoiceHistorical(
                invoicesFor.id,
                invoiceMonth,
                historical,
              );
              if (result.error) toast.error(result.error);
              else
                toast.success(
                  historical
                    ? "Marcada como já paga — não desconta do saldo."
                    : "Pagamento volta a descontar do saldo.",
                );
            })
          }
        />
      ) : null}

      {paying ? (
        <PayInvoiceDialog
          key={`pay-${paying.card.id}-${paying.invoice.month}`}
          card={paying.card}
          invoice={paying.invoice}
          accounts={accounts}
          open
          onOpenChange={(next) => {
            if (!next) setPaying(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CardLimit({ card }: { card: CardWithInvoices }) {
  const percent =
    card.limit_cents > 0
      ? Math.min(100, Math.round((card.usedCents / card.limit_cents) * 100))
      : 0;

  const barColor =
    card.status === "exceeded"
      ? "bg-destructive"
      : card.status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-600";

  return (
    <div className="flex flex-col gap-1">
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p
        className={cn(
          "text-xs tabular-nums",
          card.status === "exceeded" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {card.status === "exceeded"
          ? `Limite estourado em ${formatBRL(-card.availableCents)}`
          : `${formatBRL(card.availableCents)} disponíveis de ${formatBRL(card.limit_cents)}`}
      </p>
    </div>
  );
}
