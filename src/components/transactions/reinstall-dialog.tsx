"use client";

import { useEffect, useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import {
  changeInstallments,
  getInstallmentGroup,
  type InstallmentGroup,
} from "@/actions/transactions";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonthShort } from "@/lib/dates";
import { planReinstallment } from "@/lib/installments";
import { MAX_INSTALLMENTS, formatBRL } from "@/lib/money";
import type { Transaction } from "@/types/database";

/**
 * Reparcelar uma compra no crédito já lançada.
 *
 * A prévia roda `planReinstallment` — a MESMA função pura que a server action
 * usa para gravar. O que aparece aqui é literalmente o que será salvo; não há
 * uma segunda implementação para divergir.
 */
export function ReinstallDialog({
  transaction,
  onOpenChange,
}: {
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={transaction !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        {/* Remonta por transação: o estado do formulário reseta sozinho. */}
        {transaction ? (
          <ReinstallForm
            key={transaction.id}
            transaction={transaction}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReinstallForm({
  transaction,
  onOpenChange,
}: {
  transaction: Transaction;
  onOpenChange: (open: boolean) => void;
}) {
  const [group, setGroup] = useState<InstallmentGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(1);
  const [totalCents, setTotalCents] = useState(0);
  const [saving, startSaving] = useTransition();

  const transactionId = transaction.id;

  useEffect(() => {
    let active = true;

    getInstallmentGroup(transactionId)
      .then((loaded) => {
        if (!active) return;
        setGroup(loaded);
        if (loaded) {
          setCount(loaded.parcels.length);
          setTotalCents(loaded.totalCents);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [transactionId]);

  const preview = group
    ? planReinstallment({
        parcels: group.parcels,
        paidMonths: new Set(group.paidMonths),
        newCount: count,
        totalCents,
      })
    : null;

  const countItems = Object.fromEntries(
    Array.from({ length: MAX_INSTALLMENTS }, (_, i) => [
      String(i + 1),
      i === 0 ? "À vista" : `${i + 1}x`,
    ]),
  );

  function submit() {
    startSaving(async () => {
      const result = await changeInstallments(transactionId, count, totalCents);
      if (result.error) toast.error(result.error);
      else {
        toast.success(
          count === 1 ? "Compra virou à vista." : `Compra reparcelada em ${count}x.`,
        );
        onOpenChange(false);
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reparcelar compra</DialogTitle>
        <DialogDescription>
          &ldquo;{transaction.description}&rdquo; — o valor total é redividido
          entre as parcelas.
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <p className="text-muted-foreground py-4 text-sm">Carregando parcelas…</p>
      ) : !group ? (
        <p role="alert" className="text-destructive py-4 text-sm">
          Não foi possível carregar o parcelamento.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reinstall-total">Valor total da compra</Label>
              <MoneyInput
                id="reinstall-total"
                defaultCents={group.totalCents}
                onCentsChange={setTotalCents}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Parcelas</Label>
              <Select
                items={countItems}
                value={String(count)}
                onValueChange={(value) => setCount(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map(
                    (n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? "À vista" : `${n}x`}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Hoje: {group.parcels.length === 1 ? "à vista" : `${group.parcels.length}x`}{" "}
            — total de {formatBRL(group.totalCents)}.
          </p>

          {preview?.ok === false ? (
            <p role="alert" className="text-destructive text-sm">
              {preview.error}
            </p>
          ) : null}

          {preview?.ok ? (
            <>
              {preview.plan.lockedCount > 0 ? (
                <p className="text-muted-foreground flex items-start gap-1.5 rounded-lg border p-3 text-xs">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {preview.plan.lockedCount === 1
                      ? "1 parcela já está em fatura paga e não muda"
                      : `${preview.plan.lockedCount} parcelas já estão em faturas pagas e não mudam`}{" "}
                    ({formatBRL(preview.plan.lockedCents)}). O restante é
                    redividido a partir da próxima.
                  </span>
                </p>
              ) : null}

              {preview.plan.create.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="eyebrow">Novas parcelas</p>
                  <ul className="divide-y rounded-lg border text-sm">
                    {preview.plan.create.map((parcel) => (
                      <li
                        key={parcel.invoice_month}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="text-muted-foreground text-xs">
                          {parcel.installment_number
                            ? `${parcel.installment_number}/${preview.plan.installmentTotal}`
                            : "À vista"}{" "}
                          · fatura{" "}
                          <span className="capitalize">
                            {formatMonthShort(parcel.invoice_month)}
                          </span>
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatBRL(parcel.amount_cents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Nenhuma parcela nova: o que já foi pago cobre o total.
                </p>
              )}
            </>
          ) : null}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          onClick={submit}
          disabled={saving || loading || !preview?.ok || totalCents <= 0}
        >
          Salvar
        </Button>
      </DialogFooter>
    </>
  );
}
