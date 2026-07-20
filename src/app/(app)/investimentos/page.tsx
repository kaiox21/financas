import type { Metadata } from "next";

import { InvestmentsPanel } from "@/components/investments/investments-panel";
import { PageHeader } from "@/components/page-header";
import { listAccounts } from "@/lib/queries/accounts";
import { listInvestments } from "@/lib/queries/investments";

export const metadata: Metadata = { title: "Investimentos" };

export default async function InvestimentosPage() {
  const [investments, accounts] = await Promise.all([
    listInvestments(),
    listAccounts(),
  ]);

  const active = accounts.filter((account) => !account.archived);

  return (
    <>
      <PageHeader
        title="Patrimônio"
        description="Contas mais investimentos. O valor atual de cada investimento é informado por você."
      />
      <InvestmentsPanel
        investments={investments}
        accounts={active}
        accountsBalanceCents={active.reduce(
          (sum, account) => sum + account.balance_cents,
          0,
        )}
      />
    </>
  );
}
