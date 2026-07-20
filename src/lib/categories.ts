import type { Category, TxType } from "@/types/database";

export type CategoryWithChildren = Category & { children: Category[] };

/** Categorias raiz com suas subcategorias, para montar selects agrupados. */
export function groupByParent(
  categories: Category[],
  type?: TxType,
): CategoryWithChildren[] {
  const filtered = type ? categories.filter((c) => c.type === type) : categories;

  const roots = filtered
    .filter((category) => !category.parent_id)
    .map((category) => ({ ...category, children: [] as Category[] }));
  const byId = new Map(roots.map((root) => [root.id, root]));

  for (const category of filtered) {
    if (!category.parent_id) continue;
    byId.get(category.parent_id)?.children.push(category);
  }

  return roots;
}
