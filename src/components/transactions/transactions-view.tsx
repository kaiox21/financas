"use client";

import { useState, useTransition } from "react";
import { CreditCard as CreditCardIcon, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteTransaction } from "@/actions/transactions";
import {
  TransactionSheet,
  type TransactionFormData,
} from "@/components/transactions/transaction-sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDayMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type { TransactionView } from "@/lib/queries/transactions";
import type { Transaction } from "@/types/database";

export function TransactionsView({
  transactions,
  formData,
}: {
  transactions: TransactionView[];
  formData: TransactionFormData;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [deleting, setDeleting] = useState<TransactionView | null>(null);
  const [, startTransition] = useTransition();

  function remove(id: string, scope: "one" | "remaining") {
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteTransaction(id, scope);
      if (result.error) toast.error(result.error);
      else
        toast.success(
          scope === "remaining" ? "Parcelas excluídas." : "Transação excluída.",
        );
    });
  }

  function openNew() {
    setEditing(undefined);
    setOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setOpen(true);
  }

  const byDay = groupByDay(transactions);

  return (
    <>
      {transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum lançamento neste mês.
          </p>
          <Button onClick={openNew}>
            <Plus />
            Lançar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {byDay.map(([day, items]) => (
            <section key={day} className="flex flex-col gap-1">
              <h2 className="text-muted-foreground px-1 text-xs font-medium">
                {formatDayMonth(day)}
              </h2>
              <ul className="divide-y rounded-lg border">
                {items.map((transaction) => (
                  <li
                    key={transaction.id}
                    className="flex items-center gap-3 p-3"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: `${transaction.category?.color ?? "#6b7280"}20`,
                        color: transaction.category?.color ?? "#6b7280",
                      }}
                      aria-hidden
                    >
                      {(transaction.category?.name ?? "?").slice(0, 2)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {transaction.description}
                        {transaction.installment_total ? (
                          <span className="text-muted-foreground ml-1.5 text-xs font-normal tabular-nums">
                            {transaction.installment_number}/
                            {transaction.installment_total}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                        {transaction.category?.name ?? "Sem categoria"}
                        {transaction.sourceName ? ` · ${transaction.sourceName}` : ""}
                        {transaction.payment_method === "credito" ? (
                          <CreditCardIcon className="size-3" />
                        ) : (
                          ` · ${PAYMENT_METHOD_LABELS[transaction.payment_method]}`
                        )}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 font-medium tabular-nums",
                        transaction.type === "income"
                          ? "text-emerald-600 dark:text-emerald-500"
                          : "text-foreground",
                      )}
                    >
                      {transaction.type === "income" ? "+" : "−"}
                      {formatBRL(transaction.amount_cents).replace("R$", "").trim()}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Ações de ${transaction.description}`}
                          />
                        }
                      >
                        <MoreVertical />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(transaction)}>
                          <Pencil />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            // Apagar uma parcela isolada quase nunca é o desejado,
                            // então parcelamento abre o diálogo de escopo.
                            if (transaction.installment_group_id) {
                              setDeleting(transaction);
                            } else {
                              remove(transaction.id, "one");
                            }
                          }}
                        >
                          <Trash2 />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* FAB: sempre visível, acima da nav inferior no mobile. */}
      <Button
        onClick={openNew}
        size="icon-lg"
        aria-label="Novo lançamento"
        className="fixed right-4 bottom-20 z-30 size-14 rounded-full shadow-lg md:bottom-6"
      >
        <Plus className="size-6" />
      </Button>

      <TransactionSheet
        key={editing?.id ?? "new"}
        data={formData}
        transaction={editing}
        open={open}
        onOpenChange={setOpen}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir parcelamento</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.description}&rdquo; é a parcela{" "}
              {deleting?.installment_number}/{deleting?.installment_total}. O que
              você quer excluir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => deleting && remove(deleting.id, "one")}
            >
              Só esta parcela
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && remove(deleting.id, "remaining")}
            >
              Esta e as próximas
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function groupByDay(transactions: TransactionView[]): [string, TransactionView[]][] {
  const groups = new Map<string, TransactionView[]>();
  for (const transaction of transactions) {
    const list = groups.get(transaction.date);
    if (list) list.push(transaction);
    else groups.set(transaction.date, [transaction]);
  }
  return [...groups.entries()];
}
