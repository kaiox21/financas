import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { RecurringPanel } from "@/components/recurring/recurring-panel";
import { Button } from "@/components/ui/button";
import { listActiveAccountsAndCards } from "@/lib/queries/accounts";
import { listCategories } from "@/lib/queries/categories";
import { listRecurring } from "@/lib/queries/recurring";

export const metadata: Metadata = { title: "Recorrentes" };

export default async function RecorrentesPage() {
  const [rules, categories, sources] = await Promise.all([
    listRecurring(),
    listCategories(),
    listActiveAccountsAndCards(),
  ]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-2"
        render={<Link href="/transacoes" />}
      >
        <ChevronLeft />
        Transações
      </Button>

      <PageHeader
        title="Recorrentes"
        description="A regra fica aqui; os lançamentos aparecem sozinhos na lista do mês."
      />

      <RecurringPanel
        rules={rules}
        formData={{
          categories,
          accounts: sources.accounts,
          cards: sources.cards,
        }}
      />
    </>
  );
}
