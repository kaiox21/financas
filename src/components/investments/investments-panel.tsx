"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Pencil, Plus, RefreshCw, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { deleteInvestment } from "@/actions/investments";
import {
  ContributeDialog,
  InvestmentDialog,
  UpdateValueDialog,
} from "@/components/investments/investment-dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  INVESTMENT_TYPE_COLORS,
  INVESTMENT_TYPE_LABELS,
  byType,
  netWorth,
  type InvestmentWithReturn,
} from "@/lib/investment-summary";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/database";

export function InvestmentsPanel({
  investments,
  accounts,
  accountsBalanceCents,
}: {
  investments: InvestmentWithReturn[];
  accounts: Account[];
  accountsBalanceCents: number;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InvestmentWithReturn | null>(null);
  const [contributing, setContributing] = useState<InvestmentWithReturn | null>(null);
  const [updating, setUpdating] = useState<InvestmentWithReturn | null>(null);
  const [, startTransition] = useTransition();

  const worth = netWorth([accountsBalanceCents], investments);
  const groups = byType(investments);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border p-4">
        <p className="text-muted-foreground text-xs">Patrimônio total</p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatBRL(worth.totalCents)}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Em contas</dt>
            <dd className="tabular-nums">{formatBRL(worth.accountsCents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Investido</dt>
            <dd className="tabular-nums">{formatBRL(worth.investedCents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Total aportado</dt>
            <dd className="tabular-nums">{formatBRL(worth.contributedCents)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Rendimento</dt>
            <dd
              className={cn(
                "tabular-nums",
                worth.returnCents > 0 && "text-emerald-600 dark:text-emerald-500",
                worth.returnCents < 0 && "text-destructive",
              )}
            >
              {worth.returnCents >= 0 ? "+" : "−"}
              {formatBRL(Math.abs(worth.returnCents))}
            </dd>
          </div>
        </dl>

        {groups.length > 1 ? (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
              {groups.map((group) => (
                <span
                  key={group.type}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${group.share * 100}%`,
                    backgroundColor: INVESTMENT_TYPE_COLORS[group.type],
                  }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {groups.map((group) => (
                <li key={group.type} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: INVESTMENT_TYPE_COLORS[group.type] }}
                    aria-hidden
                  />
                  <span className="text-muted-foreground">
                    {group.label} {Math.round(group.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Novo investimento
        </Button>
      </div>

      {investments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum investimento ainda. Cadastre um e registre aportes — o dinheiro sai
            da conta e passa a contar como patrimônio investido.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {investments.map((investment) => (
            <li key={investment.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{investment.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {INVESTMENT_TYPE_LABELS[investment.type]}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-medium tabular-nums">
                    {formatBRL(investment.current_value_cents)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ações de ${investment.name}`}
                        />
                      }
                    >
                      <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setContributing(investment)}>
                        <TrendingUp />
                        Aportar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setUpdating(investment)}>
                        <RefreshCw />
                        Atualizar valor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditing(investment)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deleteInvestment(investment.id);
                            if (result.error) toast.error(result.error);
                            else toast.success("Investimento excluído.");
                          })
                        }
                      >
                        <Trash2 />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                Aportado {formatBRL(investment.contributedCents)}
                {investment.returnRate === null ? null : (
                  <>
                    {" · "}
                    <span
                      className={cn(
                        investment.returnCents > 0 &&
                          "text-emerald-600 dark:text-emerald-500",
                        investment.returnCents < 0 && "text-destructive",
                      )}
                    >
                      {investment.returnCents >= 0 ? "+" : "−"}
                      {formatBRL(Math.abs(investment.returnCents))} (
                      {(investment.returnRate * 100).toFixed(1).replace(".", ",")}%)
                    </span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <InvestmentDialog
        key="new"
        open={creating}
        onOpenChange={setCreating}
      />
      {editing ? (
        <InvestmentDialog
          key={`edit-${editing.id}`}
          investment={editing}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      ) : null}
      {contributing ? (
        <ContributeDialog
          key={`contrib-${contributing.id}`}
          investment={contributing}
          accounts={accounts}
          open
          onOpenChange={(next) => {
            if (!next) setContributing(null);
          }}
        />
      ) : null}
      {updating ? (
        <UpdateValueDialog
          key={`value-${updating.id}`}
          investment={updating}
          open
          onOpenChange={(next) => {
            if (!next) setUpdating(null);
          }}
        />
      ) : null}
    </div>
  );
}
