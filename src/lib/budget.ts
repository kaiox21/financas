import type { BudgetLine, Category } from "@/types/database";

export type BudgetLineView = BudgetLine & { category: Category | null };

/** Rótulo do custo: a descrição, senão a categoria, senão um genérico. */
export function budgetLineLabel(line: BudgetLineView): string {
  return line.description ?? line.category?.name ?? "Gasto planejado";
}
