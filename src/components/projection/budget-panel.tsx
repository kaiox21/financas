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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { groupByParent } from "@/lib/categories";
import { emptyState } from "@/lib/form-state";
import { formatBRL } from "@/lib/money";
import { budgetLineLabel, type BudgetLineView } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { Category, TxType } from "@/types/database";

export function BudgetPanel({
  lines,
  categories,
  expenseCents,
  incomeCents,
  averageCents,
}: {
  lines: BudgetLineView[];
  categories: Category[];
  expenseCents: number;
  incomeCents: number;
  averageCents: number;
}) {
  const [tab, setTab] = useState<TxType>("expense");
  const [editing, setEditing] = useState<BudgetLineView | null>(null);
  const [creating, setCreating] = useState<TxType | null>(null);
  const [, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteBudgetLine(id);
      if (result.error) toast.error(result.error);
      else toast.success("Item removido.");
    });
  }

  const expenses = lines.filter((line) => line.type === "expense");
  const income = lines.filter((line) => line.type === "income");

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-muted-foreground text-xs">Entradas planejadas / mês</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-500">
            {formatBRL(incomeCents)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Saídas planejadas / mês</p>
          <p className="text-lg font-semibold tabular-nums">{formatBRL(expenseCents)}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TxType)}>
        <TabsList className="w-full">
          <TabsTrigger value="expense">Saídas</TabsTrigger>
          <TabsTrigger value="income">Entradas</TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="pt-3">
          <Section
            lines={expenses}
            type="expense"
            emptyHint={
              <>
                Some seus gastos do dia a dia — alimentação, lazer, transporte. A
                projeção subtrai cada um de todo mês, junto com os fixos.
                {averageCents > 0
                  ? ` Nos últimos meses você gastou em média ${formatBRL(averageCents)} fora de recorrentes e parcelas.`
                  : ""}
              </>
            }
            onAdd={() => setCreating("expense")}
            onEdit={setEditing}
            onRemove={remove}
          />
        </TabsContent>

        <TabsContent value="income" className="pt-3">
          <Section
            lines={income}
            type="income"
            emptyHint={
              <>
                Receitas que se repetem todo mês além do salário — freela, bônus,
                aluguel recebido. A projeção soma cada uma em todo mês futuro.
              </>
            }
            onAdd={() => setCreating("income")}
            onEdit={setEditing}
            onRemove={remove}
          />
        </TabsContent>
      </Tabs>

      <p className="text-muted-foreground text-xs">
        Salário e outras recorrentes que você já cadastrou em Transações →
        Recorrentes já entram na projeção — não precisa repetir aqui.
      </p>

      {creating ? (
        <BudgetLineDialog
          key={`new-${creating}`}
          type={creating}
          categories={categories}
          suggestedCents={
            creating === "expense" && expenses.length === 0 && averageCents > 0
              ? averageCents
              : undefined
          }
          open
          onOpenChange={(next) => {
            if (!next) setCreating(null);
          }}
        />
      ) : null}
      {editing ? (
        <BudgetLineDialog
          key={`edit-${editing.id}`}
          line={editing}
          type={editing.type}
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

function Section({
  lines,
  type,
  emptyHint,
  onAdd,
  onEdit,
  onRemove,
}: {
  lines: BudgetLineView[];
  type: TxType;
  emptyHint: React.ReactNode;
  onAdd: () => void;
  onEdit: (line: BudgetLineView) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus />
          {type === "income" ? "Nova entrada" : "Nova saída"}
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-muted-foreground text-xs">{emptyHint}</p>
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
              <span
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  type === "income" && "text-emerald-600 dark:text-emerald-500",
                )}
              >
                {type === "income" ? "+" : ""}
                {formatBRL(line.amount_cents)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${budgetLineLabel(line)}`}
                onClick={() => onEdit(line)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ${budgetLineLabel(line)}`}
                onClick={() => onRemove(line.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BudgetLineDialog({
  line,
  type,
  categories,
  suggestedCents,
  open,
  onOpenChange,
}: {
  line?: BudgetLineView;
  type: TxType;
  categories: Category[];
  suggestedCents?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveBudgetLine, emptyState);
  const [categoryId, setCategoryId] = useState<string | null>(line?.category_id ?? null);
  const editing = Boolean(line);
  const isIncome = type === "income";

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Item atualizado." : "Item adicionado.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  const groups = groupByParent(categories, type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? isIncome
                  ? "Editar entrada"
                  : "Editar saída"
                : isIncome
                  ? "Nova entrada planejada"
                  : "Nova saída planejada"}
            </DialogTitle>
            <DialogDescription>
              {isIncome
                ? "Uma receita média que se repete todo mês. A projeção soma isso a cada mês futuro."
                : "Um gasto médio que se repete todo mês. A projeção subtrai isso de cada mês futuro."}
            </DialogDescription>
          </DialogHeader>

          {line ? <input type="hidden" name="id" value={line.id} /> : null}
          <input type="hidden" name="type" value={type} />
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
              placeholder={isIncome ? "Ex.: Freela mensal" : "Ex.: Mercado e feira"}
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
