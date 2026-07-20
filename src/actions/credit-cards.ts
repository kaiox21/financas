"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import {
  failure,
  firstIssue,
  positiveMoneyField,
  requireUserId,
  success,
  type FormState,
} from "./utils";

/** 1–28 espelha o check do banco: evita a classe de bugs de fevereiro. */
const dayField = z.coerce
  .number()
  .int()
  .min(1, "Dia deve estar entre 1 e 28")
  .max(28, "Dia deve estar entre 1 e 28");

const cardSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(40, "Nome muito longo"),
  limit_cents: positiveMoneyField,
  closing_day: dayField,
  due_day: dayField,
});

function revalidate() {
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath("/");
}

export async function saveCreditCard(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = cardSchema.safeParse({
    name: formData.get("name"),
    limit_cents: formData.get("limit_cents"),
    closing_day: formData.get("closing_day"),
    due_day: formData.get("due_day"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const id = formData.get("id");
  const supabase = await createClient();

  if (typeof id === "string" && id) {
    const { error } = await supabase.from("credit_cards").update(parsed.data).eq("id", id);
    if (error) return failure("Não foi possível salvar o cartão.");
  } else {
    const { error } = await supabase
      .from("credit_cards")
      .insert({ ...parsed.data, user_id: await requireUserId() });
    if (error) return failure("Não foi possível criar o cartão.");
  }

  revalidate();
  return success;
}

export async function setCreditCardArchived(id: string, archived: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("credit_cards").update({ archived }).eq("id", id);
  if (error) throw error;
  revalidate();
}

export async function deleteCreditCard(id: string): Promise<FormState> {
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("credit_card_id", id);
  if (countError) return failure("Não foi possível verificar as transações do cartão.");

  if (count && count > 0) {
    return failure(
      `Este cartão tem ${count} transação(ões). Arquive-o em vez de excluir, para não perder o histórico.`,
    );
  }

  const { error } = await supabase.from("credit_cards").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir o cartão.");

  revalidate();
  return success;
}
