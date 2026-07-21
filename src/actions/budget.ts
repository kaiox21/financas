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

const lineSchema = z.object({
  type: z.enum(["income", "expense"]),
  category_id: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable(),
  description: z
    .string()
    .trim()
    .max(120, "Descrição muito longa")
    .transform((value) => value || null)
    .nullable(),
  amount_cents: positiveMoneyField,
});

function revalidate() {
  revalidatePath("/projecao");
  revalidatePath("/");
}

export async function saveBudgetLine(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawAmount = formData.get("amount_cents");
  if (typeof rawAmount !== "string" || rawAmount.trim() === "") {
    return failure("Informe o valor por mês (ex.: 800,00).");
  }

  const parsed = lineSchema.safeParse({
    type: formData.get("type") ?? "expense",
    category_id: formData.get("category_id") ?? "",
    description: formData.get("description") ?? "",
    amount_cents: rawAmount,
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  // Sem categoria e sem descrição, a linha não teria como ser identificada.
  if (!parsed.data.category_id && !parsed.data.description) {
    return failure("Escolha uma categoria ou dê um nome ao custo.");
  }

  const supabase = await createClient();
  const id = formData.get("id");

  if (typeof id === "string" && id) {
    const { error } = await supabase.from("budget_lines").update(parsed.data).eq("id", id);
    if (error) return failure("Não foi possível salvar o custo.");
  } else {
    const { error } = await supabase
      .from("budget_lines")
      .insert({ ...parsed.data, user_id: await requireUserId() });
    if (error) return failure("Não foi possível criar o custo.");
  }

  revalidate();
  return success;
}

export async function deleteBudgetLine(id: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.from("budget_lines").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir o custo.");

  revalidate();
  return success;
}
