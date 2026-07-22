import { getCategories } from "@/lib/queries/request-cache";
import type { Category } from "@/types/database";

export { groupByParent, type CategoryWithChildren } from "@/lib/categories";

export async function listCategories(): Promise<Category[]> {
  return getCategories();
}
