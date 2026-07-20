"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteCategory } from "@/actions/categories";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { groupByParent } from "@/lib/categories";
import type { Category, TxType } from "@/types/database";

export function CategoriesPanel({ categories }: { categories: Category[] }) {
  const [type, setType] = useState<TxType>("expense");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>();
  const [, startTransition] = useTransition();

  function openNew() {
    setEditing(undefined);
    setOpen(true);
  }

  function remove(category: Category) {
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.error) toast.error(result.error);
      else toast.success("Categoria excluída.");
    });
  }

  const roots = categories.filter((category) => !category.parent_id);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={type} onValueChange={(value) => setType(value as TxType)}>
        <TabsList className="w-full">
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
        </TabsList>

        {(["expense", "income"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="pt-4">
            <div className="mb-3 flex justify-end">
              <Button onClick={openNew}>
                <Plus />
                Nova categoria
              </Button>
            </div>

            <ul className="flex flex-col gap-2">
              {groupByParent(categories, tab).map((group) => (
                <li key={group.id} className="rounded-lg border">
                  <Row
                    category={group}
                    onEdit={() => {
                      setEditing(group);
                      setOpen(true);
                    }}
                    onDelete={() => remove(group)}
                  />

                  {group.children.length > 0 ? (
                    <ul className="border-t">
                      {group.children.map((child) => (
                        <li key={child.id} className="border-b last:border-b-0">
                          <Row
                            category={child}
                            nested
                            onEdit={() => {
                              setEditing(child);
                              setOpen(true);
                            }}
                            onDelete={() => remove(child)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </TabsContent>
        ))}
      </Tabs>

      <CategoryDialog
        key={editing?.id ?? `new-${type}`}
        category={editing}
        parents={roots}
        defaultType={type}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

function Row({
  category,
  nested = false,
  onEdit,
  onDelete,
}: {
  category: Category;
  nested?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 ${nested ? "pl-10" : ""}`}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${category.color}20`, color: category.color }}
      >
        <CategoryIcon name={category.icon} className="size-4" />
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {category.name}
        {category.is_default ? (
          <span className="text-muted-foreground ml-2 text-xs font-normal">padrão</span>
        ) : null}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ações de ${category.name}`}
            />
          }
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
