"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveRecurring } from "@/actions/recurring";
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
import { groupByParent } from "@/lib/categories";
import { today } from "@/lib/dates";
import { emptyState } from "@/lib/form-state";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, usesCreditCard } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type {
  Account,
  Category,
  CreditCard,
  PaymentMethod,
  RecurringTransaction,
  TxType,
} from "@/types/database";

export type RecurringFormData = {
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
};

export function RecurringDialog({
  data,
  rule,
  open,
  onOpenChange,
}: {
  data: RecurringFormData;
  rule?: RecurringTransaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveRecurring, emptyState);
  const editing = Boolean(rule);

  const [type, setType] = useState<TxType>(rule?.type ?? "expense");
  const [method, setMethod] = useState<PaymentMethod>(rule?.payment_method ?? "pix");
  const [categoryId, setCategoryId] = useState<string | null>(rule?.category_id ?? null);
  const [accountId, setAccountId] = useState(
    rule?.account_id ?? data.accounts[0]?.id ?? "",
  );
  const [cardId, setCardId] = useState(rule?.credit_card_id ?? data.cards[0]?.id ?? "");

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Recorrência atualizada." : "Recorrência criada.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  const onCredit = usesCreditCard(method);
  const groups = groupByParent(data.categories, type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar recorrência" : "Nova recorrência"}
            </DialogTitle>
            <DialogDescription>
              Salário, aluguel, assinaturas — tudo que se repete todo mês no mesmo
              dia.
            </DialogDescription>
          </DialogHeader>

          {rule ? <input type="hidden" name="id" value={rule.id} /> : null}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="payment_method" value={method} />
          <input type="hidden" name="category_id" value={categoryId ?? ""} />
          <input type="hidden" name="account_id" value={onCredit ? "" : accountId} />
          <input type="hidden" name="credit_card_id" value={onCredit ? cardId : ""} />

          <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
            {(["expense", "income"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setType(option);
                  setCategoryId(null);
                }}
                className={cn(
                  "rounded-md py-2 text-sm font-medium transition-colors",
                  type === option
                    ? option === "expense"
                      ? "bg-destructive text-white"
                      : "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "expense" ? "Saída" : "Entrada"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-description">Descrição</Label>
            <Input
              id="rec-description"
              name="description"
              defaultValue={rule?.description}
              placeholder="Aluguel, Netflix, salário…"
              maxLength={120}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-amount">Valor</Label>
              <MoneyInput
                id="rec-amount"
                name="amount_cents"
                defaultCents={rule?.amount_cents}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-day">Dia do mês</Label>
              <Input
                id="rec-day"
                name="day_of_month"
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                defaultValue={rule?.day_of_month ?? 10}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={(value) => setCategoryId(value as string | null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Sem categoria</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Forma de pagamento</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {PAYMENT_METHOD_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{onCredit ? "Cartão" : "Conta"}</Label>
            {onCredit ? (
              <Select value={cardId} onValueChange={(value) => setCardId(value as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {data.cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={accountId}
                onValueChange={(value) => setAccountId(value as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  {data.accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-start">Começa em</Label>
              <Input
                id="rec-start"
                name="start_date"
                type="date"
                defaultValue={rule?.start_date ?? today()}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-end">Termina em</Label>
              <Input
                id="rec-end"
                name="end_date"
                type="date"
                defaultValue={rule?.end_date ?? ""}
              />
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Deixe &ldquo;termina em&rdquo; vazio para não ter fim. Os lançamentos são
            criados até o mês atual; os meses futuros aparecem só na projeção.
          </p>

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
