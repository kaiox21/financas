import { getAccounts, getCreditCards, getTransactions } from "@/lib/queries/request-cache";
import type { Account, CreditCard } from "@/types/database";

/** Saldo é sempre computado — nunca armazenado — para não dessincronizar. */
export type AccountWithBalance = Account & { balance_cents: number };

export async function listAccounts(): Promise<AccountWithBalance[]> {
  const [accounts, transactions] = await Promise.all([getAccounts(), getTransactions()]);

  const delta = new Map<string, number>();
  for (const movement of transactions) {
    // Compras no crédito têm account_id nulo; pagamentos históricos entram como
    // affects_balance=false (já refletidos no saldo inicial). Ambos ficam fora.
    if (!movement.account_id || !movement.affects_balance) continue;
    const signed =
      movement.type === "income" ? movement.amount_cents : -movement.amount_cents;
    delta.set(movement.account_id, (delta.get(movement.account_id) ?? 0) + signed);
  }

  return accounts.map((account) => ({
    ...account,
    balance_cents: account.initial_balance_cents + (delta.get(account.id) ?? 0),
  }));
}

export async function listCreditCards(): Promise<CreditCard[]> {
  return getCreditCards();
}

/** Só os ativos — é o que os formulários de lançamento oferecem. */
export async function listActiveAccountsAndCards() {
  const [accounts, cards] = await Promise.all([listAccounts(), listCreditCards()]);
  return {
    accounts: accounts.filter((account) => !account.archived),
    cards: cards.filter((card) => !card.archived),
  };
}
