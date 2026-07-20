"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import {
  failure,
  firstIssue,
  moneyField,
  requireUserId,
  success,
  type FormState,
} from "./utils";

const accountSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(40, "Nome muito longo"),
  initial_balance_cents: moneyField,
});

function revalidate() {
  revalidatePath("/contas");
  revalidatePath("/transacoes");
  revalidatePath("/");
}

export async function saveAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    initial_balance_cents: formData.get("initial_balance_cents"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const id = formData.get("id");
  const supabase = await createClient();

  if (typeof id === "string" && id) {
    const { error } = await supabase.from("accounts").update(parsed.data).eq("id", id);
    if (error) return failure("Não foi possível salvar a conta.");
  } else {
    const { error } = await supabase
      .from("accounts")
      .insert({ ...parsed.data, user_id: await requireUserId() });
    if (error) {
      return failure("Não foi possível criar a conta.");
    }
  }

  revalidate();
  return success;
}

export async function setAccountArchived(id: string, archived: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update({ archived }).eq("id", id);
  if (error) throw error;
  revalidate();
}

export async function deleteAccount(id: string): Promise<FormState> {
  const supabase = await createClient();

  // Sem transações a conta some limpa; com transações, arquivar preserva o histórico.
  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", id);
  if (countError) return failure("Não foi possível verificar as transações da conta.");

  if (count && count > 0) {
    return failure(
      `Esta conta tem ${count} transação(ões). Arquive-a em vez de excluir, para não perder o histórico.`,
    );
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir a conta.");

  revalidate();
  return success;
}
