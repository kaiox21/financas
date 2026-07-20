"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveAccount } from "@/actions/accounts";
import { emptyState } from "@/lib/form-state";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account } from "@/types/database";

export function AccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account?: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveAccount, emptyState);
  const editing = Boolean(account);

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Conta atualizada." : "Conta criada.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "O saldo inicial é o ponto de partida — o saldo atual é sempre calculado a partir das transações."
                : "Informe o saldo que a conta tem hoje. Ele vira o saldo inicial e as transações passam a partir dele."}
            </DialogDescription>
          </DialogHeader>

          {account ? <input type="hidden" name="id" value={account.id} /> : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-name">Nome</Label>
            <Input
              id="account-name"
              name="name"
              defaultValue={account?.name}
              placeholder="Nubank, Itaú, Carteira…"
              maxLength={40}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-balance">
              {editing ? "Saldo inicial" : "Saldo atual"}
            </Label>
            <MoneyInput
              id="account-balance"
              name="initial_balance_cents"
              defaultCents={account?.initial_balance_cents ?? 0}
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {editing ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Estado de abertura + qual conta está sendo editada. */
export function useAccountDialog() {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<Account | undefined>();

  return {
    open,
    account,
    openNew: () => {
      setAccount(undefined);
      setOpen(true);
    },
    openEdit: (target: Account) => {
      setAccount(target);
      setOpen(true);
    },
    onOpenChange: setOpen,
  };
}
