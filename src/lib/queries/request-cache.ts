import { cache } from "react";

import { currentMonth } from "@/lib/dates";
import { buildRecurringOccurrences } from "@/lib/queries/materialize";
import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  BudgetLine,
  Category,
  CreditCard,
  Investment,
  RecurringTransaction,
  Transaction,
} from "@/types/database";

/**
 * Camada de leitura por request. Cada tabela é buscada no máximo uma vez por
 * render, graças ao `cache()` do React: quando dashboard, projeção e contas
 * pedem as mesmas contas/categorias/transações, tudo colapsa numa única query.
 *
 * Antes, cada `load*` abria seu próprio cliente e refazia as mesmas leituras —
 * a mesma navegação chegava a buscar contas, categorias e transações duas ou
 * três vezes. Centralizar aqui elimina esse retrabalho sem mudar o resultado.
 */

export const getAccounts = cache(async (): Promise<Account[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("archived")
    .order("name");
  if (error) throw error;
  return data;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  return data;
});

export const getCreditCards = cache(async (): Promise<CreditCard[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .order("archived")
    .order("name");
  if (error) throw error;
  return data;
});

export const getActiveRules = cache(async (): Promise<RecurringTransaction[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("active", true);
  if (error) throw error;
  return data;
});

export const getInvestments = cache(async (): Promise<Investment[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("investments").select("*").order("name");
  if (error) throw error;
  return data;
});

export const getBudgetLineRows = cache(async (): Promise<BudgetLine[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_lines")
    .select("*")
    .order("amount_cents", { ascending: false });
  if (error) throw error;
  return data;
});

/**
 * Todas as transações do usuário, em ordem (data desc, criação desc), com as
 * ocorrências de recorrentes materializadas até o mês corrente.
 *
 * A materialização mora aqui de propósito: quem lê transações já as quer
 * completas, então basta uma passagem. Só há INSERT quando o mês vira (ou uma
 * regra nova aparece) — o caso comum é uma única leitura. Após inserir,
 * relê para devolver a lista consistente e já ordenada.
 */
export const getTransactions = cache(async (): Promise<Transaction[]> => {
  const supabase = await createClient();
  const query = () =>
    supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

  const [transactions, rules, cards] = await Promise.all([
    query(),
    getActiveRules(),
    getCreditCards(),
  ]);
  if (transactions.error) throw transactions.error;

  const missing = buildRecurringOccurrences(
    rules,
    cards,
    transactions.data,
    currentMonth(),
  );
  if (missing.length === 0) return transactions.data;

  const inserted = await supabase.from("transactions").insert(missing);
  // Idempotente: um conflito no índice único só significa que outra carga já
  // materializou. Mantém o que já temos em vez de derrubar o render.
  if (inserted.error) return transactions.data;

  const refreshed = await query();
  if (refreshed.error) throw refreshed.error;
  return refreshed.data;
});
