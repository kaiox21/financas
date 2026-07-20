import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";

export { groupByParent, type CategoryWithChildren } from "@/lib/categories";

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  return data;
}
