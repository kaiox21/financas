import { currentMonth } from "@/lib/dates";
import { invoiceMonthFor } from "@/lib/invoices";
import { missingOccurrences } from "@/lib/recurring";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

/**
 * Cria as ocorrências de recorrentes que faltam, até o mês corrente.
 *
 * Repetível por construção: só insere o que ainda não existe, então chamar a
 * cada carregamento da tela é inofensivo. O índice único (recurring_id, date)
 * é a rede de segurança no banco.
 *
 * Fica fora de `actions/` de propósito: é chamada durante o render das páginas,
 * e uma server action não pode ser invocada nesse momento.
 */
export async function materializeRecurring(): Promise<number> {
  const supabase = await createClient();
  const through = currentMonth();

  const [rules, existing, cards] = await Promise.all([
    supabase.from("recurring_transactions").select("*").eq("active", true),
    supabase
      .from("transactions")
      .select("recurring_id, date")
      .not("recurring_id", "is", null),
    supabase.from("credit_cards").select("id, closing_day, due_day"),
  ]);

  if (rules.error || existing.error || cards.error) return 0;
  if (rules.data.length === 0) return 0;

  const datesByRule = new Map<string, string[]>();
  for (const row of existing.data) {
    if (!row.recurring_id) continue;
    const list = datesByRule.get(row.recurring_id);
    if (list) list.push(row.date);
    else datesByRule.set(row.recurring_id, [row.date]);
  }

  const cycleByCard = new Map(
    cards.data.map((card) => [
      card.id,
      { closingDay: card.closing_day, dueDay: card.due_day },
    ]),
  );

  const rows: TablesInsert<"transactions">[] = [];

  for (const rule of rules.data) {
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

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("transactions").insert(rows);
  return error ? 0 : rows.length;
}
