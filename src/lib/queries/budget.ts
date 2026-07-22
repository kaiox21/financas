import { budgetLineLabel, type BudgetLineView } from "@/lib/budget";
import { getBudgetLineRows, getCategories } from "@/lib/queries/request-cache";

export { budgetLineLabel };
export type { BudgetLineView };

export async function listBudgetLines(): Promise<BudgetLineView[]> {
  const [lines, categories] = await Promise.all([getBudgetLineRows(), getCategories()]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  return lines.map((line) => ({
    ...line,
    category: line.category_id ? (byId.get(line.category_id) ?? null) : null,
  }));
}
