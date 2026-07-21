"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteBudgetLine, saveBudgetLine } from "@/actions/budget";
import { CategoryIcon } from "@/components/category-icon";
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
import { emptyState } from "@/lib/form-state";
import { formatBRL } from "@/lib/money";
import { budgetLineLabel, type BudgetLineView } from "@/lib/budget";
import type { Category } from "@/types/database";

export function BudgetPanel({
  lines,
  categories,
  totalCents,
  averageCents,
}: {
  lines: BudgetLineView[];
  categories: Category[];
  totalCents: number;
  averageCents: number;
}) {
  const [editing, setEditing] = useState<BudgetLineView | null>(null);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteBudgetLine(id);
      if (result.error) toast.error(result.error);
      else toast.success("Custo removido.");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-muted-foreground text-xs">Custos planejados por mês</p>
          <p className="text-lg font-semibold tabular-nums">{formatBRL(totalCents)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Adicionar
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Some seus gastos do dia a dia — alimentação, lazer, transporte — como
          linhas de custo. A projeção subtrai cada uma de todo mês, junto com os
          fixos.
          {averageCents > 0
            ? ` Nos últimos meses você gastou em média ${formatBRL(averageCents)} fora de recorrentes e parcelas.`
            : ""}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-2">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${line.category?.color ?? "#6b7280"}20`,
                  color: line.category?.color ?? "#6b7280",
                }}
                aria-hidden
              >
                <CategoryIcon name={line.category?.icon} className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {budgetLineLabel(line)}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatBRL(line.amount_cents)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${budgetLineLabel(line)}`}
                onClick={() => setEditing(line)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ${budgetLineLabel(line)}`}
                onClick={() => remove(line.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <BudgetLineDialog
        key={creating ? "new" : "new-closed"}
        categories={categories}
        suggestedCents={lines.length === 0 && averageCents > 0 ? averageCents : undefined}
        open={creating}
        onOpenChange={setCreating}
      />
      {editing ? (
        <BudgetLineDialog
          key={`edit-${editing.id}`}
          line={editing}
          categories={categories}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BudgetLineDialog({
  line,
  categories,
  suggestedCents,
  open,
  onOpenChange,
}: {
  line?: BudgetLineView;
  categories: Category[];
  suggestedCents?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveBudgetLine, emptyState);
  const [categoryId, setCategoryId] = useState<string | null>(line?.category_id ?? null);
  const editing = Boolean(line);

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Custo atualizado." : "Custo adicionado.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  const groups = groupByParent(categories, "expense");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar custo" : "Novo custo planejado"}</DialogTitle>
            <DialogDescription>
              Um gasto médio que se repete todo mês. Escolha a categoria e o valor —
              a projeção subtrai isso de cada mês futuro.
            </DialogDescription>
          </DialogHeader>

          {line ? <input type="hidden" name="id" value={line.id} /> : null}
          <input type="hidden" name="category_id" value={categoryId ?? ""} />

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
            <Label htmlFor="budget-desc">Nome (opcional)</Label>
            <Input
              id="budget-desc"
              name="description"
              defaultValue={line?.description ?? ""}
              placeholder="Ex.: Mercado e feira"
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-amount">Valor por mês</Label>
            <MoneyInput
              id="budget-amount"
              name="amount_cents"
              defaultCents={line?.amount_cents ?? suggestedCents}
              autoFocus
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
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
