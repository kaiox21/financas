"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveTransaction } from "@/actions/transactions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { groupByParent } from "@/lib/categories";
import { formatDateBR, formatMonthLong, today } from "@/lib/dates";
import { emptyState } from "@/lib/form-state";
import { invoiceDueDate, invoiceMonthFor } from "@/lib/invoices";
import { MAX_INSTALLMENTS, formatBRL, splitInstallments } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, usesCreditCard } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import type { Account, Category, CreditCard, PaymentMethod, Transaction, TxType } from "@/types/database";

export type TransactionFormData = {
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  defaultPaymentMethod: PaymentMethod | null;
};

export function TransactionSheet({
  data,
  transaction,
  open,
  onOpenChange,
}: {
  data: TransactionFormData;
  transaction?: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveTransaction, emptyState);
  const editing = Boolean(transaction);

  const [type, setType] = useState<TxType>(transaction?.type ?? "expense");
  const [method, setMethod] = useState<PaymentMethod>(
    transaction?.payment_method ?? data.defaultPaymentMethod ?? "pix",
  );
  const [date, setDate] = useState(transaction?.date ?? today());
  const [cardId, setCardId] = useState(transaction?.credit_card_id ?? data.cards[0]?.id ?? "");
  const [accountId, setAccountId] = useState(
    transaction?.account_id ?? data.accounts[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    transaction?.category_id ?? null,
  );
  const [installments, setInstallments] = useState(1);
  const [amountCents, setAmountCents] = useState(transaction?.amount_cents ?? 0);

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Transação atualizada." : "Transação lançada.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  const onCredit = usesCreditCard(method);
  const groups = groupByParent(data.categories, type);
  const selectedCard = data.cards.find((card) => card.id === cardId);

  // Mapas valor→rótulo: sem `items`, o gatilho do select mostra o valor cru
  // (o UUID da conta, "credito" etc.) em vez do que foi escolhido.
  const categoryItems: Record<string, string> = {
    null: "Sem categoria",
    ...Object.fromEntries(data.categories.map((c) => [c.id, c.name])),
  };
  const cardItems = Object.fromEntries(data.cards.map((c) => [c.id, c.name]));
  const accountItems = Object.fromEntries(data.accounts.map((a) => [a.id, a.name]));
  const installmentItems = Object.fromEntries(
    Array.from({ length: MAX_INSTALLMENTS }, (_, i) => [
      String(i + 1),
      i === 0 ? "À vista" : `${i + 1}x`,
    ]),
  );

  // Prévia da fatura: a mesma função pura que a server action usa para gravar.
  // O mês sozinho é ambíguo (mês da compra? do fechamento?), então mostramos
  // também a data de vencimento, que não deixa dúvida.
  const invoicePreview = (() => {
    if (!onCredit || !selectedCard) return null;
    const cycle = {
      closingDay: selectedCard.closing_day,
      dueDay: selectedCard.due_day,
    };
    const month = invoiceMonthFor(date, cycle);
    return { month: formatMonthLong(month), dueDate: formatDateBR(invoiceDueDate(month, cycle)) };
  })();

  const missingSource = onCredit ? data.cards.length === 0 : data.accounts.length === 0;
  const editingInstallment = Boolean(transaction?.installment_group_id);

  // "3x de R$ 33,34" — o resto de centavos cai na 1ª parcela, como no servidor.
  const installmentPreview =
    onCredit && !editing && installments > 1 && amountCents > 0
      ? (() => {
          const parts = splitInstallments(amountCents, installments);
          const first = formatBRL(parts[0]);
          const rest = formatBRL(parts[installments - 1]);
          return first === rest
            ? `${installments}x de ${rest}`
            : `1x de ${first} + ${installments - 1}x de ${rest}`;
        })()
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form action={formAction} className="flex flex-col gap-4 p-4">
          <SheetHeader className="p-0">
            <SheetTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</SheetTitle>
            <SheetDescription className="sr-only">
              Valor, descrição, categoria e forma de pagamento.
            </SheetDescription>
          </SheetHeader>

          {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="payment_method" value={method} />
          <input type="hidden" name="category_id" value={categoryId ?? ""} />
          <input type="hidden" name="account_id" value={onCredit ? "" : accountId} />
          <input type="hidden" name="credit_card_id" value={onCredit ? cardId : ""} />
          <input
            type="hidden"
            name="installments"
            value={onCredit ? installments : 1}
          />

          {/* Saída vem primeiro e já selecionada: é a maioria dos lançamentos. */}
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
            <Label htmlFor="tx-amount">Valor</Label>
            <MoneyInput
              id="tx-amount"
              name="amount_cents"
              defaultCents={transaction?.amount_cents}
              onCentsChange={setAmountCents}
              className="h-12 text-lg"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tx-description">Descrição</Label>
            <Input
              id="tx-description"
              name="description"
              defaultValue={transaction?.description}
              placeholder="Mercado, salário, uber…"
              maxLength={120}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Categoria</Label>
              <Select
                items={categoryItems}
                value={categoryId}
                onValueChange={(value) => setCategoryId(value as string | null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sem categoria</SelectItem>
                  {groups.map((group) => (
                    <SelectGroupItems key={group.id} group={group} />
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tx-date">Data</Label>
              <Input
                id="tx-date"
                name="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Forma de pagamento</Label>
            <Select
              items={PAYMENT_METHOD_LABELS}
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
              <Select
                items={cardItems}
                value={cardId}
                onValueChange={(value) => setCardId(value as string)}
              >
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
                items={accountItems}
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

          {onCredit && !editing ? (
            <div className="flex flex-col gap-2">
              <Label>Parcelas</Label>
              <Select
                items={installmentItems}
                value={String(installments)}
                onValueChange={(value) => setInstallments(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 1 ? "À vista" : `${n}x`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {installmentPreview ? (
            <p className="text-muted-foreground text-xs">
              {installmentPreview}
            </p>
          ) : null}

          {invoicePreview ? (
            <p className="text-muted-foreground text-xs">
              {installments > 1 ? "A 1ª parcela entra" : "Entra"} na fatura de{" "}
              <strong className="capitalize">{invoicePreview.month}</strong>, que vence
              em <strong>{invoicePreview.dueDate}</strong>. Não sai da conta agora — só
              quando você pagar a fatura.
            </p>
          ) : null}

          {editingInstallment ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">
                Parcela {transaction!.installment_number}/
                {transaction!.installment_total}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value="one"
                  defaultChecked
                  className="accent-primary"
                />
                Alterar só esta parcela
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value="remaining"
                  className="accent-primary"
                />
                Alterar esta e as próximas
              </label>
            </div>
          ) : null}

          {missingSource ? (
            <p role="alert" className="text-destructive text-sm">
              {onCredit
                ? "Nenhum cartão cadastrado. Cadastre um em Contas → Cartões."
                : "Nenhuma conta cadastrada. Cadastre uma em Contas."}
            </p>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          ) : null}

          <SheetFooter className="p-0">
            <Button type="submit" size="lg" disabled={pending || missingSource}>
              {editing ? "Salvar" : "Lançar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SelectGroupItems({
  group,
}: {
  group: Category & { children: Category[] };
}) {
  return (
    <>
      <SelectItem value={group.id}>{group.name}</SelectItem>
      {group.children.map((child) => (
        <SelectItem key={child.id} value={child.id}>
          <span className="text-muted-foreground pl-3">↳ {child.name}</span>
        </SelectItem>
      ))}
    </>
  );
}
