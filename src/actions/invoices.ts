"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formatMonthLong, isValidDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

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
    category_id: null,
  });
  if (error) return failure("Não foi possível registrar o pagamento.");

  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath("/");
  return success;
}
