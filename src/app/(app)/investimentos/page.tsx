import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Investimentos" };

export default function InvestimentosPage() {
  return (
    <>
      <PageHeader title="Investimentos" description="Patrimônio e aportes." />
      <p className="text-muted-foreground text-sm">CRUD de investimentos chega na Fase 6.</p>
    </>
  );
}
