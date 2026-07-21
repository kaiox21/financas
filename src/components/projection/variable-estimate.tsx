"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { saveVariableEstimate } from "@/actions/settings";
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
import { emptyState } from "@/lib/form-state";
import { formatBRL } from "@/lib/money";

export function VariableEstimate({
  usedCents,
  estimateCents,
  averageCents,
  windowMonths,
}: {
  usedCents: number;
  estimateCents: number | null;
  averageCents: number;
  windowMonths: number;
}) {
  const [open, setOpen] = useState(false);
  const usingManual = estimateCents !== null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Gasto variável por mês</p>
          <p className="text-lg font-semibold tabular-nums">{formatBRL(usedCents)}</p>
          <p className="text-muted-foreground text-xs">
            {usingManual
              ? "definido por você"
              : averageCents > 0
                ? `média dos últimos ${windowMonths} meses`
                : "sem histórico ainda — informe um valor"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil />
          Ajustar
        </Button>
      </div>

      <EstimateDialog
        key={open ? "open" : "closed"}
        estimateCents={estimateCents}
        averageCents={averageCents}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function EstimateDialog({
  estimateCents,
  averageCents,
  open,
  onOpenChange,
}: {
  estimateCents: number | null;
  averageCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveVariableEstimate,
    emptyState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Estimativa atualizada.");
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Gasto variável estimado</DialogTitle>
            <DialogDescription>
              Alimentação, lazer, transporte do dia a dia — o que não é recorrente
              nem parcela. A projeção subtrai esse valor de cada mês.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="estimate">Valor por mês</Label>
            <MoneyInput
              id="estimate"
              name="variable_estimate_cents"
              defaultCents={estimateCents ?? (averageCents > 0 ? averageCents : undefined)}
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              {averageCents > 0
                ? `Sua média histórica é ${formatBRL(averageCents)}. `
                : ""}
              Deixe em branco para usar a média automática dos últimos meses.
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
