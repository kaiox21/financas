import { budgetLineLabel, type BudgetLineView } from "@/lib/budget";
import { createClient } from "@/lib/supabase/server";

export { budgetLineLabel };
export type { BudgetLineView };

export async function listBudgetLines(): Promise<BudgetLineView[]> {
  const supabase = await createClient();

  const [lines, categories] = await Promise.all([
    supabase.from("budget_lines").select("*").order("amount_cents", { ascending: false }),
    supabase.from("categories").select("*"),
  ]);

  if (lines.error) throw lines.error;
  if (categories.error) throw categories.error;

  const byId = new Map(categories.data.map((c) => [c.id, c]));
  return lines.data.map((line) => ({
    ...line,
    category: line.category_id ? (byId.get(line.category_id) ?? null) : null,
  }));
}
