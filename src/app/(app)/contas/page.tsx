import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Contas e cartões" };

export default function ContasPage() {
  return (
    <>
      <PageHeader title="Contas e cartões" description="Saldos e faturas." />
      <p className="text-muted-foreground text-sm">CRUD de contas e cartões chega na Fase 4.</p>
    </>
  );
}
