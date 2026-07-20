import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriasPage() {
  return (
    <>
      <PageHeader title="Categorias" description="Organize seus gastos." />
      <p className="text-muted-foreground text-sm">CRUD de categorias chega na Fase 5.</p>
    </>
  );
}
