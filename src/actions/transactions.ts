"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isValidDate } from "@/lib/dates";
import { invoiceMonthFor } from "@/lib/invoices";
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

const PAYMENT_METHODS = [
  "dinheiro",
  "pix",
  "debito",
  "credito",
  "boleto",
  "transferencia",
] as const;

const optionalId = z
  .string()
  .trim()
  .transform((value) => value || null)
  .nullable();

const transactionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe uma descrição")
    .max(120, "Descrição muito longa"),
  amount_cents: positiveMoneyField,
  type: z.enum(["income", "expense"]),
  date: z.string().refine(isValidDate, "Data inválida"),
  payment_method: z.enum(PAYMENT_METHODS),
  category_id: optionalId,
  account_id: optionalId,
  credit_card_id: optionalId,
});

function readForm(formData: FormData) {
  return transactionSchema.safeParse({
    description: formData.get("description"),
    amount_cents: formData.get("amount_cents"),
    type: formData.get("type"),
    date: formData.get("date"),
    payment_method: formData.get("payment_method"),
    category_id: formData.get("category_id") ?? "",
    account_id: formData.get("account_id") ?? "",
    credit_card_id: formData.get("credit_card_id") ?? "",
  });
}

function revalidate() {
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/");
}

export async function saveTransaction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readForm(formData);
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const input = parsed.data;
  const supabase = await createClient();

  let invoiceMonth: string | null = null;

  if (input.payment_method === "credito") {
    if (!input.credit_card_id) return failure("Escolha o cartão de crédito.");

    const { data: card, error } = await supabase
      .from("credit_cards")
      .select("closing_day, due_day")
      .eq("id", input.credit_card_id)
      .single();
    if (error || !card) return failure("Cartão não encontrado.");

    // O mês da fatura é derivado do ciclo do cartão — nunca escolhido à mão.
    invoiceMonth = invoiceMonthFor(input.date, {
      closingDay: card.closing_day,
      dueDay: card.due_day,
    });
  } else if (!input.account_id) {
    return failure("Escolha a conta.");
  }

  const fields = {
    description: input.description,
    amount_cents: input.amount_cents,
    type: input.type,
    date: input.date,
    payment_method: input.payment_method,
    category_id: input.category_id,
    account_id: input.payment_method === "credito" ? null : input.account_id,
    credit_card_id: input.payment_method === "credito" ? input.credit_card_id : null,
    invoice_month: invoiceMonth,
  } satisfies Omit<TablesInsert<"transactions">, "user_id">;

  const id = formData.get("id");

  if (typeof id === "string" && id) {
    const { error } = await supabase.from("transactions").update(fields).eq("id", id);
    if (error) return failure("Não foi possível salvar a transação.");
  } else {
    const { error } = await supabase
      .from("transactions")
      .insert({ ...fields, user_id: await requireUserId() });
    if (error) return failure("Não foi possível criar a transação.");
  }

  revalidate();
  return success;
}

export async function deleteTransaction(id: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir a transação.");

  revalidate();
  return success;
}
