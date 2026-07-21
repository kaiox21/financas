"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formatMonthLong, isValidDate, today } from "@/lib/dates";
import { buildInvoices } from "@/lib/invoice-summary";
import { invoiceDueDate } from "@/lib/invoices";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

import {
  failure,
  firstIssue,
  positiveMoneyField,
  requireUserId,
  success,
  type FormState,
} from "./utils";

const paySchema = z.object({
  credit_card_id: z.uuid("Cartão inválido"),
  invoice_month: z.string().refine(isValidDate, "Fatura inválida"),
  account_id: z.uuid("Escolha a conta que vai pagar"),
  amount_cents: positiveMoneyField,
  date: z.string().refine(isValidDate, "Data inválida"),
  payment_method: z.enum(["dinheiro", "pix", "debito", "boleto", "transferencia"]),
  // Checkbox: fatura já quitada antes de usar o app → marca paga sem descontar.
  historical: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
});

/**
 * Pagar a fatura é uma saída da conta — não some com as compras.
 * As compras continuam contando como gasto no mês em que aconteceram; este
 * lançamento é o dinheiro efetivamente saindo do caixa.
 */
export async function payInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = paySchema.safeParse({
    credit_card_id: formData.get("credit_card_id"),
    invoice_month: formData.get("invoice_month"),
    account_id: formData.get("account_id"),
    amount_cents: formData.get("amount_cents"),
    date: formData.get("date"),
    payment_method: formData.get("payment_method"),
    historical: formData.get("historical") ?? undefined,
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const input = parsed.data;
  const supabase = await createClient();

  const { data: card, error: cardError } = await supabase
    .from("credit_cards")
    .select("name")
    .eq("id", input.credit_card_id)
    .single();
  if (cardError || !card) return failure("Cartão não encontrado.");

  const { error } = await supabase.from("transactions").insert({
    user_id: await requireUserId(),
    description: `Fatura ${card.name} — ${formatMonthLong(input.invoice_month)}`,
    amount_cents: input.amount_cents,
    type: "expense",
    date: input.date,
    payment_method: input.payment_method,
    account_id: input.account_id,
    credit_card_id: input.credit_card_id,
    invoice_month: input.invoice_month,
    is_invoice_payment: true,
    affects_balance: !input.historical,
    category_id: null,
  });
  if (error) return failure("Não foi possível registrar o pagamento.");

  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath("/");
  return success;
}

/**
 * Quita de uma vez todas as faturas já FECHADAS e ainda em aberto de um cartão,
 * como pagamento histórico (fatura fica paga, sem descontar do saldo). Serve
 * para o cadastro inicial: faturas antigas que você já pagou na vida real, mas
 * cujo pagamento não deve mexer no saldo atual.
 *
 * A fatura aberta (ciclo corrente) fica de fora — essa você paga quando fechar.
 */
export async function settleClosedInvoicesHistorical(
  creditCardId: string,
): Promise<FormState> {
  const supabase = await createClient();
  const reference = today();

  const [card, transactions, account] = await Promise.all([
    supabase
      .from("credit_cards")
      .select("name, closing_day, due_day")
      .eq("id", creditCardId)
      .single(),
    supabase
      .from("transactions")
      .select(
        "type, amount_cents, invoice_month, payment_method, is_invoice_payment, affects_balance",
      )
      .eq("credit_card_id", creditCardId),
    // Pagamento precisa referenciar uma conta (constraint do banco), ainda que
    // não afete o saldo por ser histórico. Usa a primeira conta ativa.
    supabase
      .from("accounts")
      .select("id")
      .eq("archived", false)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);

  if (card.error || !card.data) return failure("Cartão não encontrado.");
  if (transactions.error) return failure("Não foi possível ler as faturas.");
  if (!account.data) return failure("Cadastre uma conta antes de quitar faturas.");

  const cycle = { closingDay: card.data.closing_day, dueDay: card.data.due_day };
  const invoices = buildInvoices(transactions.data, cycle, reference);
  const pending = invoices.filter((invoice) => !invoice.isOpen && !invoice.isPaid);

  if (pending.length === 0) {
    return failure("Nenhuma fatura fechada em aberto para quitar.");
  }

  const userId = await requireUserId();
  const accountId = account.data.id;
  const cardName = card.data.name;
  const rows: TablesInsert<"transactions">[] = pending.map((invoice) => ({
    user_id: userId,
    description: `Fatura ${cardName} — ${formatMonthLong(invoice.month)}`,
    amount_cents: invoice.outstandingCents,
    type: "expense",
    date: invoiceDueDate(invoice.month, cycle),
    payment_method: "pix",
    account_id: accountId,
    credit_card_id: creditCardId,
    invoice_month: invoice.month,
    is_invoice_payment: true,
    affects_balance: false,
    category_id: null,
  }));

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) return failure("Não foi possível quitar as faturas.");

  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath("/");
  return success;
}

/**
 * Corrige pagamentos já lançados: alterna entre descontar do saldo e tratar
 * como histórico (fatura segue paga, sem mexer no saldo). Vale para todos os
 * pagamentos daquele mês de fatura no cartão de uma vez.
 */
export async function setInvoiceHistorical(
  creditCardId: string,
  invoiceMonth: string,
  historical: boolean,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ affects_balance: !historical })
    .eq("credit_card_id", creditCardId)
    .eq("invoice_month", invoiceMonth)
    .eq("is_invoice_payment", true);
  if (error) return failure("Não foi possível atualizar o pagamento.");

  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath("/");
  return success;
}
