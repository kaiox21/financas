import type { Metadata } from "next";

import { CategoriesPanel } from "@/components/categories/categories-panel";
import { PageHeader } from "@/components/page-header";
import { listCategories } from "@/lib/queries/categories";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  const categories = await listCategories();

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Até dois níveis: categoria e subcategoria."
      />
      <CategoriesPanel categories={categories} />
    </>
  );
}
