"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { payInvoice } from "@/actions/invoices";
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
import { formatDateBR, formatMonthLong, today } from "@/lib/dates";
import { emptyState } from "@/lib/form-state";
import { formatBRL } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import type { Invoice } from "@/lib/invoice-summary";
import type { Account, CreditCard, PaymentMethod } from "@/types/database";

/** Crédito não paga crédito. */
const METHODS: PaymentMethod[] = ["pix", "debito", "transferencia", "boleto", "dinheiro"];

export function PayInvoiceDialog({
  card,
  invoice,
  accounts,
  open,
  onOpenChange,
}: {
  card: CreditCard;
  invoice: Invoice | null;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(payInvoice, emptyState);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState<PaymentMethod>("pix");

  useEffect(() => {
    if (state.ok) {
      toast.success("Pagamento registrado.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Pagar fatura</DialogTitle>
            <DialogDescription>
              {card.name} · fatura de {formatMonthLong(invoice.month)} · vence em{" "}
              {formatDateBR(invoice.dueDate)}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="credit_card_id" value={card.id} />
          <input type="hidden" name="invoice_month" value={invoice.month} />
          <input type="hidden" name="account_id" value={accountId} />
          <input type="hidden" name="payment_method" value={method} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-amount">Valor</Label>
            <MoneyInput
              id="pay-amount"
              name="amount_cents"
              defaultCents={invoice.outstandingCents}
            />
            <p className="text-muted-foreground text-xs">
              Em aberto: {formatBRL(invoice.outstandingCents)}. Pagar menos deixa o
              resto em aberto.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Conta</Label>
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
              <Label htmlFor="pay-date">Data</Label>
              <Input
                id="pay-date"
                name="date"
                type="date"
                defaultValue={today()}
                required
              />
            </div>
          </div>

          {accounts.length === 0 ? (
            <p role="alert" className="text-destructive text-sm">
              Nenhuma conta cadastrada para pagar a fatura.
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
              Registrar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
