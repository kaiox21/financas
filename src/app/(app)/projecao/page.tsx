import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Projeção" };

export default function ProjecaoPage() {
  return (
    <>
      <PageHeader title="Projeção" description="Seus próximos 6 meses." />
      <p className="text-muted-foreground text-sm">Projeção chega na Fase 8.</p>
    </>
  );
}
