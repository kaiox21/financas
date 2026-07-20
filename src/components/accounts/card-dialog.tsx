"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveCreditCard } from "@/actions/credit-cards";
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
import type { CreditCard } from "@/types/database";

export function CardDialog({
  card,
  open,
  onOpenChange,
}: {
  card?: CreditCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveCreditCard, emptyState);
  const editing = Boolean(card);

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Cartão atualizado." : "Cartão criado.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle>
            <DialogDescription>
              A compra entra na fatura que ainda não fechou; o pagamento da fatura é
              que sai da conta.
            </DialogDescription>
          </DialogHeader>

          {card ? <input type="hidden" name="id" value={card.id} /> : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="card-name">Nome</Label>
            <Input
              id="card-name"
              name="name"
              defaultValue={card?.name}
              placeholder="Nubank, Inter…"
              maxLength={40}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="card-limit">Limite</Label>
            <MoneyInput
              id="card-limit"
              name="limit_cents"
              defaultCents={card?.limit_cents}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="card-closing">Dia do fechamento</Label>
              <Input
                id="card-closing"
                name="closing_day"
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                defaultValue={card?.closing_day ?? 1}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="card-due">Dia do vencimento</Label>
              <Input
                id="card-due"
                name="due_day"
                type="number"
                min={1}
                max={28}
                inputMode="numeric"
                defaultValue={card?.due_day ?? 10}
                required
              />
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Dias limitados a 1–28 de propósito: fevereiro não tem 29, 30 nem 31, e
            isso evita toda uma classe de bugs de data.
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
              {editing ? "Salvar" : "Criar cartão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useCardDialog() {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CreditCard | undefined>();

  return {
    open,
    card,
    openNew: () => {
      setCard(undefined);
      setOpen(true);
    },
    openEdit: (target: CreditCard) => {
      setCard(target);
      setOpen(true);
    },
    onOpenChange: setOpen,
  };
}
