"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteAccount, setAccountArchived } from "@/actions/accounts";
import { AccountDialog, useAccountDialog } from "@/components/accounts/account-dialog";
import { MoneyFigure } from "@/components/money-figure";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AccountWithBalance } from "@/lib/queries/accounts";

export function AccountsPanel({ accounts }: { accounts: AccountWithBalance[] }) {
  const dialog = useAccountDialog();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const active = accounts.filter((account) => !account.archived);
  const archived = accounts.filter((account) => account.archived);
  const total = active.reduce((sum, account) => sum + account.balance_cents, 0);

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
      <div className="bg-muted/50 flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="eyebrow">Saldo total</p>
          <MoneyFigure cents={total} size="md" />
        </div>
        <Button onClick={dialog.openNew}>
          <Plus />
          Nova conta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState onCreate={dialog.openNew} />
      ) : (
        <ul className="flex flex-col gap-2">
          {[...active, ...archived].map((account) => (
            <li
              key={account.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-4",
                account.archived && "opacity-60",
                busyId === account.id && pending && "animate-pulse",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {account.name}
                  {account.archived ? (
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      arquivada
                    </span>
                  ) : null}
                </p>
                <p
                  className={cn(
                    "tabular-nums",
                    account.balance_cents < 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {formatBRL(account.balance_cents)}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label="Ações da conta" />
                  }
                >
                  <MoreVertical />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => dialog.openEdit(account)}>
                    <Pencil />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      run(account.id, async () => {
                        await setAccountArchived(account.id, !account.archived);
                        toast.success(
                          account.archived ? "Conta reativada." : "Conta arquivada.",
                        );
                      })
                    }
                  >
                    {account.archived ? <ArchiveRestore /> : <Archive />}
                    {account.archived ? "Reativar" : "Arquivar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() =>
                      run(account.id, async () => {
                        const result = await deleteAccount(account.id);
                        if (result.error) toast.error(result.error);
                        else toast.success("Conta excluída.");
                      })
                    }
                  >
                    <Trash2 />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <AccountDialog
        key={dialog.account?.id ?? "new"}
        account={dialog.account}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <p className="text-muted-foreground text-sm">
        Nenhuma conta ainda. Cadastre a primeira para começar a lançar transações.
      </p>
      <Button onClick={onCreate}>
        <Plus />
        Nova conta
      </Button>
    </div>
  );
}
