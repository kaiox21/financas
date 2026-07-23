"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { addMonths, addMonthsToMonth, isValidDate, today, type MonthStr } from "@/lib/dates";
import { planReinstallment, type ParcelRow } from "@/lib/installments";
import { buildInvoices } from "@/lib/invoice-summary";
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

/** O grupo de parcelas + quais faturas já estão quitadas. */
export type InstallmentGroup = {
  groupId: string;
  parcels: ParcelRow[];
  /** Meses de fatura já pagos — travam as parcelas que caem neles. */
  paidMonths: MonthStr[];
  totalCents: number;
};

async function loadInstallmentGroup(
  transactionId: string,
): Promise<InstallmentGroup | null> {
  const supabase = await createClient();

  const { data: source, error: sourceError } = await supabase
    .from("transactions")
    .select("installment_group_id, credit_card_id")
    .eq("id", transactionId)
    .single();
  if (sourceError || !source?.installment_group_id || !source.credit_card_id) {
    return null;
  }

  const groupId = source.installment_group_id;

  const [parcels, card, cardTransactions] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount_cents, date, invoice_month, installment_number")
      .eq("installment_group_id", groupId),
    supabase
      .from("credit_cards")
      .select("closing_day, due_day")
      .eq("id", source.credit_card_id)
      .single(),
    supabase
      .from("transactions")
      .select(
        "type, amount_cents, invoice_month, payment_method, is_invoice_payment, affects_balance",
      )
      .eq("credit_card_id", source.credit_card_id),
  ]);

  if (parcels.error || card.error || cardTransactions.error) return null;

  // Fatura quitada trava a parcela: mexer nela reabriria uma fatura já paga.
  const paidMonths = buildInvoices(
    cardTransactions.data,
    { closingDay: card.data.closing_day, dueDay: card.data.due_day },
    today(),
  )
    .filter((invoice) => invoice.isPaid)
    .map((invoice) => invoice.month);

  return {
    groupId,
    parcels: parcels.data,
    paidMonths,
    totalCents: parcels.data.reduce((sum, parcel) => sum + parcel.amount_cents, 0),
  };
}

/**
 * Dados do parcelamento para a tela de reparcelar montar a prévia com a mesma
 * função pura que o servidor usa para gravar — prévia e resultado não divergem.
 */
export async function getInstallmentGroup(
  transactionId: string,
): Promise<InstallmentGroup | null> {
  return loadInstallmentGroup(transactionId);
}

/**
 * Troca o número de parcelas de uma compra já lançada.
 *
 * O total é redistribuído entre as parcelas — é o mesmo contrato da criação,
 * onde você informa o valor da compra e o app divide. Passar `totalCents`
 * diferente do atual também permite corrigir o valor da compra de uma vez
 * (útil quando o parcelamento foi renegociado).
 *
 * Parcelas que já caíram em fatura paga não são tocadas: ver `lib/installments`.
 */
export async function changeInstallments(
  transactionId: string,
  newCount: number,
  totalCents: number,
): Promise<FormState> {
  const count = installmentsSchema.safeParse(newCount);
  if (!count.success) return failure(firstIssue(count.error));

  const group = await loadInstallmentGroup(transactionId);
  if (!group) return failure("Esta transação não faz parte de um parcelamento.");

  const { groupId } = group;

  // Replaneja no servidor: a prévia do cliente nunca é a fonte da verdade.
  const result = planReinstallment({
    parcels: group.parcels,
    paidMonths: new Set(group.paidMonths),
    newCount: count.data,
    totalCents,
  });
  if (!result.ok) return failure(result.error);

  const { plan } = result;
  const supabase = await createClient();

  const { error } = await supabase.rpc("reinstall_purchase", {
    p_group_id: groupId,
    p_delete_ids: plan.deleteIds,
    p_keep_ids: plan.keepIds,
    p_installment_total: plan.installmentTotal,
    p_new_rows: plan.create.map((parcel) => ({
      amount_cents: parcel.amount_cents,
      date: parcel.date,
      invoice_month: parcel.invoice_month,
      installment_number: parcel.installment_number,
    })),
  });
  if (error) return failure("Não foi possível reparcelar a compra.");

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
