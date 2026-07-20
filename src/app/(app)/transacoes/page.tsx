import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Transações" };

export default function TransacoesPage() {
  return (
    <>
      <PageHeader title="Transações" description="Lançamentos do mês." />
      <p className="text-muted-foreground text-sm">Lista e lançamento rápido chegam na Fase 2.</p>
    </>
  );
}
