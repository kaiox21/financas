"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isValidDate } from "@/lib/dates";
import { materializeRecurring } from "@/lib/queries/materialize";
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

const optionalId = z
  .string()
  .trim()
  .transform((value) => value || null)
  .nullable();

const ruleSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe uma descrição")
    .max(120, "Descrição muito longa"),
  amount_cents: positiveMoneyField,
  type: z.enum(["income", "expense"]),
  payment_method: z.enum([
    "dinheiro",
    "pix",
    "debito",
    "credito",
    "boleto",
    "transferencia",
  ]),
  day_of_month: z.coerce
    .number()
    .int()
    .min(1, "Dia deve estar entre 1 e 28")
    .max(28, "Dia deve estar entre 1 e 28"),
  start_date: z.string().refine(isValidDate, "Data de início inválida"),
  end_date: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .refine((value) => value === null || isValidDate(value), "Data de fim inválida"),
  category_id: optionalId,
  account_id: optionalId,
  credit_card_id: optionalId,
});

function revalidate() {
  revalidatePath("/transacoes");
  revalidatePath("/transacoes/recorrentes");
  revalidatePath("/contas");
  revalidatePath("/");
}

export async function saveRecurring(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ruleSchema.safeParse({
    description: formData.get("description"),
    amount_cents: formData.get("amount_cents"),
    type: formData.get("type"),
    payment_method: formData.get("payment_method"),
    day_of_month: formData.get("day_of_month"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") ?? "",
    category_id: formData.get("category_id") ?? "",
    account_id: formData.get("account_id") ?? "",
    credit_card_id: formData.get("credit_card_id") ?? "",
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const input = parsed.data;
  if (input.payment_method === "credito" && !input.credit_card_id) {
    return failure("Escolha o cartão de crédito.");
  }
  if (input.payment_method !== "credito" && !input.account_id) {
    return failure("Escolha a conta.");
  }
  if (input.end_date && input.end_date < input.start_date) {
    return failure("O fim precisa ser depois do início.");
  }

  const fields = {
    description: input.description,
    amount_cents: input.amount_cents,
    type: input.type,
    payment_method: input.payment_method,
    day_of_month: input.day_of_month,
    start_date: input.start_date,
    end_date: input.end_date,
    category_id: input.category_id,
    account_id: input.payment_method === "credito" ? null : input.account_id,
    credit_card_id: input.payment_method === "credito" ? input.credit_card_id : null,
  } satisfies Omit<TablesInsert<"recurring_transactions">, "user_id">;

  const supabase = await createClient();
  const id = formData.get("id");

  if (typeof id === "string" && id) {
    // Editar a regra vale daqui para frente: as ocorrências já materializadas
    // são transações comuns e ficam como estão.
    const { error } = await supabase
      .from("recurring_transactions")
      .update(fields)
      .eq("id", id);
    if (error) return failure("Não foi possível salvar a recorrência.");
  } else {
    const { error } = await supabase
      .from("recurring_transactions")
      .insert({ ...fields, user_id: await requireUserId() });
    if (error) return failure("Não foi possível criar a recorrência.");
  }

  await materializeRecurring();
  revalidate();
  return success;
}

export async function setRecurringActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_transactions")
    .update({ active })
    .eq("id", id);
  if (error) throw error;

  if (active) await materializeRecurring();
  revalidate();
}

export async function deleteRecurring(id: string): Promise<FormState> {
  const supabase = await createClient();
  // `recurring_id` é ON DELETE SET NULL: os lançamentos já criados continuam
  // existindo, apenas deixam de estar ligados à regra.
  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir a recorrência.");

  revalidate();
  return success;
}
