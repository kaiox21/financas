"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  contribute,
  saveInvestment,
  updateInvestmentValue,
} from "@/actions/investments";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { today } from "@/lib/dates";
import { emptyState } from "@/lib/form-state";
import { INVESTMENT_TYPE_LABELS } from "@/lib/investment-summary";
import { formatBRL } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import type {
  Account,
  Investment,
  InvestmentType,
  PaymentMethod,
} from "@/types/database";

const TYPES = Object.keys(INVESTMENT_TYPE_LABELS) as InvestmentType[];
const METHODS: PaymentMethod[] = ["pix", "transferencia", "debito", "boleto", "dinheiro"];

export function InvestmentDialog({
  investment,
  open,
  onOpenChange,
}: {
  investment?: Investment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveInvestment, emptyState);
  const [type, setType] = useState<InvestmentType>(investment?.type ?? "renda_fixa");
  const editing = Boolean(investment);

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Investimento atualizado." : "Investimento criado.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar investimento" : "Novo investimento"}
            </DialogTitle>
            <DialogDescription>
              Não há cotação automática: o valor atual é você quem informa.
            </DialogDescription>
          </DialogHeader>

          {investment ? <input type="hidden" name="id" value={investment.id} /> : null}
          <input type="hidden" name="type" value={type} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-name">Nome</Label>
            <Input
              id="inv-name"
              name="name"
              defaultValue={investment?.name}
              placeholder="Tesouro Selic, CDB Nubank…"
              maxLength={60}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(value) => setType(value as InvestmentType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {INVESTMENT_TYPE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="inv-value">Valor atual</Label>
            <MoneyInput
              id="inv-value"
              name="current_value_cents"
              defaultCents={investment?.current_value_cents ?? 0}
            />
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ContributeDialog({
  investment,
  accounts,
  open,
  onOpenChange,
}: {
  investment: Investment;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(contribute, emptyState);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState<PaymentMethod>("pix");

  useEffect(() => {
    if (state.ok) {
      toast.success("Aporte registrado.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Aportar em {investment.name}</DialogTitle>
            <DialogDescription>
              Sai da conta e entra no investimento. O valor atual sobe junto.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="investment_id" value={investment.id} />
          <input type="hidden" name="account_id" value={accountId} />
          <input type="hidden" name="payment_method" value={method} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="contrib-amount">Valor</Label>
            <MoneyInput id="contrib-amount" name="amount_cents" autoFocus />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Conta de origem</Label>
            <Select value={accountId} onValueChange={(value) => setAccountId(value as string)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Forma</Label>
              <Select
                value={method}
                onValueChange={(value) => setMethod(value as PaymentMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {PAYMENT_METHOD_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contrib-date">Data</Label>
              <Input
                id="contrib-date"
                name="date"
                type="date"
                defaultValue={today()}
                required
              />
            </div>
          </div>

          {accounts.length === 0 ? (
            <p role="alert" className="text-destructive text-sm">
              Nenhuma conta cadastrada para tirar o dinheiro.
            </p>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || accounts.length === 0}>
              Aportar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UpdateValueDialog({
  investment,
  open,
  onOpenChange,
}: {
  investment: Investment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateInvestmentValue,
    emptyState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Valor atualizado.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Atualizar valor</DialogTitle>
            <DialogDescription>
              {investment.name} · hoje registrado em{" "}
              {formatBRL(investment.current_value_cents)}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={investment.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="value-now">Valor atual</Label>
            <MoneyInput
              id="value-now"
              name="current_value_cents"
              defaultCents={investment.current_value_cents}
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              Copie do extrato da corretora. A diferença para o total aportado é o
              rendimento.
            </p>
          </div>

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
