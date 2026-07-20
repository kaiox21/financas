import type { Metadata } from "next";

import { AccountsPanel } from "@/components/accounts/accounts-panel";
import { CardsPanel } from "@/components/accounts/cards-panel";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAccounts } from "@/lib/queries/accounts";
import { listCardsWithInvoices } from "@/lib/queries/invoices";

export const metadata: Metadata = { title: "Contas e cartões" };

export default async function ContasPage() {
  const [accounts, cards] = await Promise.all([
    listAccounts(),
    listCardsWithInvoices(),
  ]);

  return (
    <>
      <PageHeader
        title="Contas e cartões"
        description="Saldos são calculados a partir das transações — nunca digitados."
      />

      <Tabs defaultValue="contas">
        <TabsList className="w-full">
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="pt-4">
          <AccountsPanel accounts={accounts} />
        </TabsContent>

        <TabsContent value="cartoes" className="pt-4">
          <CardsPanel
            cards={cards}
            accounts={accounts.filter((account) => !account.archived)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
