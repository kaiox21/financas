"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { saveCategory } from "@/actions/categories";
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
import { CategoryIcon } from "@/components/category-icon";
import { emptyState } from "@/lib/form-state";
import {
  CATEGORY_COLORS,
  DEFAULT_COLOR,
  DEFAULT_ICON,
  ICON_NAMES,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Category, TxType } from "@/types/database";

export function CategoryDialog({
  category,
  parents,
  defaultType,
  open,
  onOpenChange,
}: {
  category?: Category;
  /** Categorias raiz que podem ser pai — subcategoria só tem um nível. */
  parents: Category[];
  defaultType: TxType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(saveCategory, emptyState);
  const editing = Boolean(category);

  const [type, setType] = useState<TxType>(category?.type ?? defaultType);
  const [icon, setIcon] = useState(category?.icon ?? DEFAULT_ICON);
  const [color, setColor] = useState(category?.color ?? DEFAULT_COLOR);
  const [parentId, setParentId] = useState<string | null>(category?.parent_id ?? null);

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Categoria atualizada." : "Categoria criada.");
      onOpenChange(false);
    }
  }, [state, editing, onOpenChange]);

  const availableParents = parents.filter(
    (parent) => parent.type === type && parent.id !== category?.id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
            <DialogDescription>
              Escolha um ícone e uma cor — é o que identifica a categoria na lista e
              nos gráficos.
            </DialogDescription>
          </DialogHeader>

          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="parent_id" value={parentId ?? ""} />

          <div className="flex items-center gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <CategoryIcon name={icon} className="size-6" />
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                name="name"
                defaultValue={category?.name}
                placeholder="Mercado, Uber, Pet…"
                maxLength={40}
                required
                autoFocus
              />
            </div>
          </div>

          {editing ? null : (
            <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
              {(["expense", "income"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setType(option);
                    setParentId(null);
                  }}
                  className={cn(
                    "rounded-md py-2 text-sm font-medium transition-colors",
                    type === option
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option === "expense" ? "Despesa" : "Receita"}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Ícone</Label>
            <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-lg border p-2">
              {ICON_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={name}
                    aria-pressed={icon === name}
                    onClick={() => setIcon(name)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md transition-colors",
                      icon === name ? "bg-accent" : "hover:bg-muted",
                    )}
                  >
                    <CategoryIcon name={name} className="size-4" />
                  </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={`Cor ${option}`}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  className={cn(
                    "size-7 rounded-full transition-transform",
                    color === option
                      ? "ring-foreground scale-110 ring-2 ring-offset-2 ring-offset-(--color-popover)"
                      : "hover:scale-110",
                  )}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Subcategoria de</Label>
            <Select
              value={parentId}
              onValueChange={(value) => setParentId(value as string | null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Nenhuma (categoria principal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Nenhuma (categoria principal)</SelectItem>
                {availableParents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
