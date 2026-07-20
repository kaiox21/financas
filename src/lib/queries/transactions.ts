import { monthRange, type MonthStr } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { summarize, type MonthSummary } from "@/lib/summary";
import type { Category, PaymentMethod, Transaction } from "@/types/database";

export { summarize };
export type { MonthSummary };

/** Transação com os nomes já resolvidos, pronta para renderizar. */
export type TransactionView = Transaction & {
  category: Category | null;
  sourceName: string | null;
};

export async function listTransactionsByMonth(month: MonthStr): Promise<{
  transactions: TransactionView[];
  summary: MonthSummary;
}> {
  const supabase = await createClient();
  const { start, end } = monthRange(month);

  const [transactions, categories, accounts, cards] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*"),
    supabase.from("accounts").select("id, name"),
    supabase.from("credit_cards").select("id, name"),
  ]);

  if (transactions.error) throw transactions.error;
  if (categories.error) throw categories.error;
  if (accounts.error) throw accounts.error;
  if (cards.error) throw cards.error;

  const categoryById = new Map(categories.data.map((c) => [c.id, c]));
  const nameById = new Map<string, string>([
    ...accounts.data.map((a) => [a.id, a.name] as const),
    ...cards.data.map((c) => [c.id, c.name] as const),
  ]);

  const views: TransactionView[] = transactions.data.map((transaction) => ({
    ...transaction,
    category: transaction.category_id
      ? (categoryById.get(transaction.category_id) ?? null)
      : null,
    sourceName:
      nameById.get(transaction.credit_card_id ?? transaction.account_id ?? "") ?? null,
  }));

  return { transactions: views, summary: summarize(views) };
}

/** Forma de pagamento mais recente — vira o default do lançamento rápido. */
export async function lastPaymentMethod(): Promise<PaymentMethod | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("payment_method")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.payment_method ?? null;
}
