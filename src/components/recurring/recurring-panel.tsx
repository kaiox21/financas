"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteRecurring, setRecurringActive } from "@/actions/recurring";
import {
  RecurringDialog,
  type RecurringFormData,
} from "@/components/recurring/recurring-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type { RecurringTransaction } from "@/types/database";

export function RecurringPanel({
  rules,
  formData,
}: {
  rules: RecurringTransaction[];
  formData: RecurringFormData;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | undefined>();
  const [, startTransition] = useTransition();

  function openNew() {
    setEditing(undefined);
    setOpen(true);
  }

  const active = rules.filter((rule) => rule.active);
  const paused = rules.filter((rule) => !rule.active);

  const monthlyIncome = active
    .filter((rule) => rule.type === "income")
    .reduce((sum, rule) => sum + rule.amount_cents, 0);
  const monthlyExpense = active
    .filter((rule) => rule.type === "expense")
    .reduce((sum, rule) => sum + rule.amount_cents, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg border p-4">
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">Todo mês, fixo</p>
          <p className="tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-500">
              +{formatBRL(monthlyIncome)}
            </span>{" "}
            <span className="text-muted-foreground">·</span>{" "}
            <span className="text-destructive">−{formatBRL(monthlyExpense)}</span>
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus />
          Nova
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhuma recorrência. Cadastre salário, aluguel e assinaturas uma vez —
            depois eles se lançam sozinhos todo mês.
          </p>
          <Button onClick={openNew}>
            <Plus />
            Nova recorrência
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...active, ...paused].map((rule) => (
            <li
              key={rule.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-4",
                !rule.active && "opacity-60",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {rule.description}
                  {rule.active ? null : (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      pausada
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  todo dia {rule.day_of_month} ·{" "}
                  {PAYMENT_METHOD_LABELS[rule.payment_method]}
                  {rule.end_date ? ` · até ${formatDateBR(rule.end_date)}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    rule.type === "income"
                      ? "text-emerald-600 dark:text-emerald-500"
                      : "text-foreground",
                  )}
                >
                  {rule.type === "income" ? "+" : "−"}
                  {formatBRL(rule.amount_cents).replace("R$", "").trim()}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Ações de ${rule.description}`}
                      />
                    }
                  >
                    <MoreVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(rule);
                        setOpen(true);
                      }}
                    >
                      <Pencil />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await setRecurringActive(rule.id, !rule.active);
                            toast.success(
                              rule.active
                                ? "Recorrência pausada."
                                : "Recorrência retomada.",
                            );
                          } catch {
                            toast.error("Algo deu errado. Tente de novo.");
                          }
                        })
                      }
                    >
                      {rule.active ? <Pause /> : <Play />}
                      {rule.active ? "Pausar" : "Retomar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteRecurring(rule.id);
                          if (result.error) toast.error(result.error);
                          else
                            toast.success(
                              "Regra excluída. Os lançamentos já criados continuam lá.",
                            );
                        })
                      }
                    >
                      <Trash2 />
                      Excluir regra
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RecurringDialog
        key={editing?.id ?? "new"}
        data={formData}
        rule={editing}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
