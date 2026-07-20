import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Início" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Início" description="Visão geral das suas finanças." />
      <p className="text-muted-foreground text-sm">Dashboard chega na Fase 7.</p>
    </>
  );
}
