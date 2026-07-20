"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isValidDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

import {
  failure,
  firstIssue,
  moneyField,
  positiveMoneyField,
  requireUserId,
  success,
  type FormState,
} from "./utils";

const investmentSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(60, "Nome muito longo"),
  type: z.enum(["renda_fixa", "renda_variavel", "reserva"]),
  current_value_cents: moneyField.refine((cents) => cents >= 0, {
    message: "O valor não pode ser negativo",
  }),
});

function revalidate() {
  revalidatePath("/investimentos");
  revalidatePath("/transacoes");
  revalidatePath("/contas");
  revalidatePath("/");
}

export async function saveInvestment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = investmentSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    current_value_cents: formData.get("current_value_cents"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const supabase = await createClient();
  const id = formData.get("id");

  if (typeof id === "string" && id) {
    const { error } = await supabase.from("investments").update(parsed.data).eq("id", id);
    if (error) return failure("Não foi possível salvar o investimento.");
  } else {
    const { error } = await supabase
      .from("investments")
      .insert({ ...parsed.data, user_id: await requireUserId() });
    if (error) return failure("Não foi possível criar o investimento.");
  }

  revalidate();
  return success;
}

export async function deleteInvestment(id: string): Promise<FormState> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("investment_id", id);

  if (count && count > 0) {
    return failure(
      `Este investimento tem ${count} aporte(s) registrado(s). Excluir apagaria o histórico de onde o dinheiro foi parar.`,
    );
  }

  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir o investimento.");

  revalidate();
  return success;
}

const contributionSchema = z.object({
  investment_id: z.uuid("Investimento inválido"),
  account_id: z.uuid("Escolha a conta de onde sai o dinheiro"),
  amount_cents: positiveMoneyField,
  date: z.string().refine(isValidDate, "Data inválida"),
  payment_method: z.enum(["pix", "debito", "transferencia", "dinheiro", "boleto"]),
});

/**
 * Aporte = saída da conta + aumento do valor investido.
 *
 * O valor atual sobe junto com o aporte. Sem isso, aportar R$ 1.000 pareceria
 * um prejuízo de R$ 1.000 até você atualizar o valor à mão — e a correção
 * imediata quase sempre é exatamente essa soma.
 */
export async function contribute(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = contributionSchema.safeParse({
    investment_id: formData.get("investment_id"),
    account_id: formData.get("account_id"),
    amount_cents: formData.get("amount_cents"),
    date: formData.get("date"),
    payment_method: formData.get("payment_method"),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const input = parsed.data;
  const supabase = await createClient();

  const { data: investment, error: readError } = await supabase
    .from("investments")
    .select("name, current_value_cents")
    .eq("id", input.investment_id)
    .single();
  if (readError || !investment) return failure("Investimento não encontrado.");

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: await requireUserId(),
    description: `Aporte — ${investment.name}`,
    amount_cents: input.amount_cents,
    type: "expense",
    date: input.date,
    payment_method: input.payment_method,
    account_id: input.account_id,
    investment_id: input.investment_id,
    category_id: null,
  });
  if (txError) return failure("Não foi possível registrar o aporte.");

  const { error: valueError } = await supabase
    .from("investments")
    .update({
      current_value_cents: investment.current_value_cents + input.amount_cents,
    })
    .eq("id", input.investment_id);
  if (valueError) return failure("Aporte lançado, mas o valor atual não subiu.");

  revalidate();
  return success;
}

/** Atualização manual do valor atual — é assim que rendimento entra no app. */
export async function updateInvestmentValue(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z
    .object({
      id: z.uuid(),
      current_value_cents: moneyField.refine((cents) => cents >= 0, {
        message: "O valor não pode ser negativo",
      }),
    })
    .safeParse({
      id: formData.get("id"),
      current_value_cents: formData.get("current_value_cents"),
    });
  if (!parsed.success) return failure(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("investments")
    .update({ current_value_cents: parsed.data.current_value_cents })
    .eq("id", parsed.data.id);
  if (error) return failure("Não foi possível atualizar o valor.");

  revalidate();
  return success;
}
