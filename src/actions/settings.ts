"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseAmountToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { failure, requireUserId, success, type FormState } from "./utils";

/** Campo vazio significa "voltar a usar a média histórica". */
const estimateField = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    if (!raw) return null;
    const cents = parseAmountToCents(raw);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido" });
      return z.NEVER;
    }
    return cents;
  });

export async function saveVariableEstimate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = estimateField.safeParse(formData.get("variable_estimate_cents") ?? "");
  if (!parsed.success) return failure("Valor inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({
    user_id: await requireUserId(),
    variable_estimate_cents: parsed.data,
  });
  if (error) return failure("Não foi possível salvar a estimativa.");

  revalidatePath("/projecao");
  revalidatePath("/");
  return success;
}
