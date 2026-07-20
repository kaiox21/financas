import { createClient } from "@/lib/supabase/server";
import type { Account, CreditCard } from "@/types/database";

/** Saldo é sempre computado — nunca armazenado — para não dessincronizar. */
export type AccountWithBalance = Account & { balance_cents: number };

export async function listAccounts(): Promise<AccountWithBalance[]> {
  const supabase = await createClient();

  const [accounts, movements] = await Promise.all([
    supabase.from("accounts").select("*").order("archived").order("name"),
    // Compras no crédito têm account_id nulo, então já ficam de fora daqui.
    // Pagamentos de fatura têm conta, e entram como saída normalmente.
    supabase
      .from("transactions")
      .select("account_id, type, amount_cents")
      .not("account_id", "is", null),
  ]);

  if (accounts.error) throw accounts.error;
  if (movements.error) throw movements.error;

  const delta = new Map<string, number>();
  for (const movement of movements.data) {
    if (!movement.account_id) continue;
    const signed =
      movement.type === "income" ? movement.amount_cents : -movement.amount_cents;
    delta.set(movement.account_id, (delta.get(movement.account_id) ?? 0) + signed);
  }

  return accounts.data.map((account) => ({
    ...account,
    balance_cents: account.initial_balance_cents + (delta.get(account.id) ?? 0),
  }));
}

export async function listCreditCards(): Promise<CreditCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .order("archived")
    .order("name");

  if (error) throw error;
  return data;
}

/** Só os ativos — é o que os formulários de lançamento oferecem. */
export async function listActiveAccountsAndCards() {
  const [accounts, cards] = await Promise.all([listAccounts(), listCreditCards()]);
  return {
    accounts: accounts.filter((account) => !account.archived),
    cards: cards.filter((card) => !card.archived),
  };
}
