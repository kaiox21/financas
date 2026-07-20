"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { addMonths, addMonthsToMonth, isValidDate, type MonthStr } from "@/lib/dates";
import { invoiceMonthFor } from "@/lib/invoices";
import { MAX_INSTALLMENTS, splitInstallments } from "@/lib/money";
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

type TransactionInput = z.infer<typeof transactionSchema>;

const installmentsSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_INSTALLMENTS, `No máximo ${MAX_INSTALLMENTS} parcelas`);

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
    const scope = formData.get("scope") === "remaining" ? "remaining" : "one";
    return updateTransaction(id, fields, scope);
  }

  const installments = installmentsSchema.safeParse(formData.get("installments") ?? "1");
  if (!installments.success) return failure(firstIssue(installments.error));

  if (installments.data > 1) {
    if (input.payment_method !== "credito") {
      return failure("Parcelamento só está disponível para compras no crédito.");
    }
    return createInstallments(input, installments.data, invoiceMonth!);
  }

  const { error } = await supabase
    .from("transactions")
    .insert({ ...fields, user_id: await requireUserId() });
  if (error) return failure("Não foi possível criar a transação.");

  revalidate();
  return success;
}

/**
 * Todas as parcelas nascem de uma vez: N transações com o mesmo
 * `installment_group_id`, cada uma na fatura do mês certo. Assim o mês que
 * você abre mostra só a parcela daquele mês, e não o valor cheio da compra.
 */
async function createInstallments(
  input: TransactionInput,
  count: number,
  firstInvoiceMonth: MonthStr,
): Promise<FormState> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const groupId = crypto.randomUUID();

  const amounts = splitInstallments(input.amount_cents, count);
  const invoiceMonths = Array.from({ length: count }, (_, i) =>
    addMonthsToMonth(firstInvoiceMonth, i),
  );

  const rows: TablesInsert<"transactions">[] = amounts.map((amount, i) => ({
    user_id: userId,
    description: input.description,
    amount_cents: amount,
    type: input.type,
    // A data serve só para a parcela aparecer no mês certo da lista. A fatura
    // vem da sequência, nunca desta data: compra dia 31 num cartão que fecha
    // dia 28 viraria 28/02 e colidiria com a fatura da parcela anterior.
    date: addMonths(input.date, i),
    payment_method: input.payment_method,
    category_id: input.category_id,
    account_id: null,
    credit_card_id: input.credit_card_id,
    invoice_month: invoiceMonths[i],
    installment_group_id: groupId,
    installment_number: i + 1,
    installment_total: count,
  }));

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) return failure("Não foi possível criar as parcelas.");

  revalidate();
  return success;
}

type EditableFields = Omit<TablesInsert<"transactions">, "user_id">;

async function updateTransaction(
  id: string,
  fields: EditableFields,
  scope: "one" | "remaining",
): Promise<FormState> {
  const supabase = await createClient();

  if (scope === "one") {
    const { error } = await supabase.from("transactions").update(fields).eq("id", id);
    if (error) return failure("Não foi possível salvar a transação.");
    revalidate();
    return success;
  }

  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select("installment_group_id, installment_number")
    .eq("id", id)
    .single();
  if (readError || !current?.installment_group_id || !current.installment_number) {
    return failure("Esta transação não faz parte de um parcelamento.");
  }

  // Data e fatura são de cada parcela — só o que descreve a compra se propaga.
  const shared = {
    description: fields.description,
    amount_cents: fields.amount_cents,
    category_id: fields.category_id,
  };

  const { error } = await supabase
    .from("transactions")
    .update(shared)
    .eq("installment_group_id", current.installment_group_id)
    .gte("installment_number", current.installment_number);
  if (error) return failure("Não foi possível salvar as parcelas.");

  revalidate();
  return success;
}

export async function deleteTransaction(
  id: string,
  scope: "one" | "remaining" = "one",
): Promise<FormState> {
  const supabase = await createClient();

  if (scope === "remaining") {
    const { data: current, error: readError } = await supabase
      .from("transactions")
      .select("installment_group_id, installment_number")
      .eq("id", id)
      .single();
    if (readError || !current?.installment_group_id || !current.installment_number) {
      return failure("Esta transação não faz parte de um parcelamento.");
    }

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("installment_group_id", current.installment_group_id)
      .gte("installment_number", current.installment_number);
    if (error) return failure("Não foi possível excluir as parcelas.");

    revalidate();
    return success;
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return failure("Não foi possível excluir a transação.");

  revalidate();
  return success;
}
