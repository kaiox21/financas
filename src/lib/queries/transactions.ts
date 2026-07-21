import { currentMonth, monthOf, monthRange, type MonthStr } from "@/lib/dates";
import { occurrenceDates } from "@/lib/recurring";
import { createClient } from "@/lib/supabase/server";
import { summarize, type MonthSummary } from "@/lib/summary";
import type {
  Category,
  PaymentMethod,
  RecurringTransaction,
  Transaction,
} from "@/types/database";

export { summarize };
export type { MonthSummary };

/** Transação com os nomes já resolvidos, pronta para renderizar. */
export type TransactionView = Transaction & {
  category: Category | null;
  sourceName: string | null;
  /**
   * Ocorrência de recorrente que ainda não existe no banco — meses futuros só
   * a mostram como previsão. Não dá para editar nem excluir: a regra é que
   * manda. Vira transação de verdade quando o mês chegar.
   */
  isProjected: boolean;
};

export async function listTransactionsByMonth(month: MonthStr): Promise<{
  transactions: TransactionView[];
  summary: MonthSummary;
  isFuture: boolean;
}> {
  const supabase = await createClient();
  const { start, end } = monthRange(month);
  const isFuture = month > currentMonth();

  const [transactions, categories, accounts, cards, rules] = await Promise.all([
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
    // Meses futuros ainda não têm as recorrentes materializadas — a
    // materialização para no mês corrente de propósito, para não criar
    // lançamentos que ainda não aconteceram.
    isFuture
      ? supabase.from("recurring_transactions").select("*").eq("active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (transactions.error) throw transactions.error;
  if (categories.error) throw categories.error;
  if (accounts.error) throw accounts.error;
  if (cards.error) throw cards.error;
  if (rules.error) throw rules.error;

  const categoryById = new Map(categories.data.map((c) => [c.id, c]));
  const nameById = new Map<string, string>([
    ...accounts.data.map((a) => [a.id, a.name] as const),
    ...cards.data.map((c) => [c.id, c.name] as const),
  ]);

  const decorate = <T extends Transaction>(transaction: T, projected: boolean) => ({
    ...transaction,
    category: transaction.category_id
      ? (categoryById.get(transaction.category_id) ?? null)
      : null,
    sourceName:
      nameById.get(transaction.credit_card_id ?? transaction.account_id ?? "") ?? null,
    isProjected: projected,
  });

  const real = transactions.data.map((transaction) => decorate(transaction, false));

  const projected = (rules.data ?? [])
    .flatMap((rule) => projectRuleForMonth(rule, month))
    .map((transaction) => decorate(transaction, true));

  const views = [...real, ...projected].sort(
    (a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description),
  );

  return { transactions: views, summary: summarize(views), isFuture };
}

/**
 * Monta a ocorrência virtual de uma regra num mês futuro. Tem a forma de uma
 * transação para atravessar a UI e o resumo sem exceção, mas o id é sintético
 * e ela nunca é gravada.
 */
function projectRuleForMonth(rule: RecurringTransaction, month: MonthStr): Transaction[] {
  return occurrenceDates(rule, month)
    .filter((date) => monthOf(date) === month)
    .map((date) => ({
      id: `projected:${rule.id}:${date}`,
      user_id: rule.user_id,
      description: rule.description,
      amount_cents: rule.amount_cents,
      type: rule.type,
      date,
      category_id: rule.category_id,
      payment_method: rule.payment_method,
      account_id: rule.account_id,
      credit_card_id: rule.credit_card_id,
      invoice_month: null,
      recurring_id: rule.id,
      installment_group_id: null,
      installment_number: null,
      installment_total: null,
      investment_id: null,
      is_invoice_payment: false,
      affects_balance: true,
      created_at: rule.created_at,
    }));
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
