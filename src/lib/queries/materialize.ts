import { currentMonth, type MonthStr } from "@/lib/dates";
import { invoiceMonthFor } from "@/lib/invoices";
import { missingOccurrences } from "@/lib/recurring";
import { createClient } from "@/lib/supabase/server";
import type {
  CreditCard,
  RecurringTransaction,
  TablesInsert,
  Transaction,
} from "@/types/database";

type CardCycle = Pick<CreditCard, "id" | "closing_day" | "due_day">;
type ExistingOccurrence = Pick<Transaction, "recurring_id" | "date">;

/**
 * Ocorrências de recorrentes que ainda faltam virar transação, até `through`.
 *
 * Função pura: recebe as regras, os cartões e as ocorrências já existentes, e
 * devolve as linhas a inserir. Fica separada da ida ao banco para poder ser
 * reaproveitada tanto na materialização direta (`materializeRecurring`) quanto
 * na carga de transações do request (`getTransactions`), sem duplicar a lógica.
 */
export function buildRecurringOccurrences(
  rules: RecurringTransaction[],
  cards: CardCycle[],
  existing: ExistingOccurrence[],
  through: MonthStr,
): TablesInsert<"transactions">[] {
  if (rules.length === 0) return [];

  const datesByRule = new Map<string, string[]>();
  for (const row of existing) {
    if (!row.recurring_id) continue;
    const list = datesByRule.get(row.recurring_id);
    if (list) list.push(row.date);
    else datesByRule.set(row.recurring_id, [row.date]);
  }

  const cycleByCard = new Map(
    cards.map((card) => [
      card.id,
      { closingDay: card.closing_day, dueDay: card.due_day },
    ]),
  );

  const rows: TablesInsert<"transactions">[] = [];

  for (const rule of rules) {
    const pending = missingOccurrences(rule, datesByRule.get(rule.id) ?? [], through);

    for (const date of pending) {
      const cycle = rule.credit_card_id ? cycleByCard.get(rule.credit_card_id) : null;
      // Regra no crédito sem cartão válido não vira lançamento: o banco recusaria.
      if (rule.payment_method === "credito" && !cycle) continue;

      rows.push({
        user_id: rule.user_id,
        description: rule.description,
        amount_cents: rule.amount_cents,
        type: rule.type,
        date,
        payment_method: rule.payment_method,
        category_id: rule.category_id,
        account_id: rule.payment_method === "credito" ? null : rule.account_id,
        credit_card_id: rule.payment_method === "credito" ? rule.credit_card_id : null,
        invoice_month:
          cycle && rule.payment_method === "credito" ? invoiceMonthFor(date, cycle) : null,
        recurring_id: rule.id,
      });
    }
  }

  return rows;
}

/**
 * Cria as ocorrências de recorrentes que faltam, até o mês corrente.
 *
 * Repetível por construção: só insere o que ainda não existe, então chamar a
 * cada carregamento da tela é inofensivo. O índice único (recurring_id, date)
 * é a rede de segurança no banco.
 *
 * Usada pelas server actions de recorrentes, que precisam materializar logo
 * após criar/reativar uma regra. No render das páginas, a materialização já
 * acontece dentro de `getTransactions`.
 */
export async function materializeRecurring(): Promise<number> {
  const supabase = await createClient();

  const [rules, existing, cards] = await Promise.all([
    supabase.from("recurring_transactions").select("*").eq("active", true),
    supabase
      .from("transactions")
      .select("recurring_id, date")
      .not("recurring_id", "is", null),
    supabase.from("credit_cards").select("id, closing_day, due_day"),
  ]);

  if (rules.error || existing.error || cards.error) return 0;

  const rows = buildRecurringOccurrences(
    rules.data,
    cards.data,
    existing.data,
    currentMonth(),
  );
  if (rows.length === 0) return 0;

  const { error } = await supabase.from("transactions").insert(rows);
  return error ? 0 : rows.length;
}
