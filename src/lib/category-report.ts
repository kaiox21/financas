/**
 * Gastos do mês agrupados por categoria — função pura, testável.
 *
 * Regras que valem a pena saber:
 * - Pagamento de fatura fica de fora: a compra já contou como gasto no mês em
 *   que aconteceu (mesma regra do resumo do mês).
 * - Subcategoria soma na categoria pai no ranking, e aparece detalhada dentro.
 * - Só despesas. Receita tem relatório próprio se um dia precisar.
 */

import { DEFAULT_COLOR, DEFAULT_ICON } from "./icons";
import type { Category, Transaction } from "@/types/database";

export type CategorySlice = {
  id: string;
  name: string;
  icon: string;
  color: string;
  amountCents: number;
  /** Fração do total do mês, 0–1. */
  share: number;
  children: CategorySlice[];
};

export type CategoryReport = {
  totalCents: number;
  slices: CategorySlice[];
};

type ReportInput = Pick<
  Transaction,
  "type" | "amount_cents" | "category_id" | "is_invoice_payment"
>;

const UNCATEGORIZED_ID = "__sem_categoria__";
const OTHERS_ID = "__outras__";

/** Cinza para os agregados: eles não são uma identidade, são o resto. */
const NEUTRAL = DEFAULT_COLOR;

export function buildCategoryReport(
  transactions: ReportInput[],
  categories: Category[],
  { topN = 6 }: { topN?: number } = {},
): CategoryReport {
  const byId = new Map(categories.map((category) => [category.id, category]));

  // amountCents por categoria folha (ou "sem categoria")
  const leafTotals = new Map<string, number>();
  let totalCents = 0;

  for (const transaction of transactions) {
    if (transaction.type !== "expense" || transaction.is_invoice_payment) continue;

    const key = transaction.category_id ?? UNCATEGORIZED_ID;
    leafTotals.set(key, (leafTotals.get(key) ?? 0) + transaction.amount_cents);
    totalCents += transaction.amount_cents;
  }

  if (totalCents === 0) return { totalCents: 0, slices: [] };

  // Sobe cada folha para a raiz, guardando o detalhe da subcategoria.
  const roots = new Map<string, { total: number; children: Map<string, number> }>();

  const rootBucket = (id: string) => {
    let entry = roots.get(id);
    if (!entry) {
      entry = { total: 0, children: new Map() };
      roots.set(id, entry);
    }
    return entry;
  };

  for (const [leafId, amount] of leafTotals) {
    const category = byId.get(leafId);
    const parentId = category?.parent_id ?? null;

    if (parentId && byId.has(parentId)) {
      const entry = rootBucket(parentId);
      entry.total += amount;
      entry.children.set(leafId, (entry.children.get(leafId) ?? 0) + amount);
    } else {
      rootBucket(leafId).total += amount;
    }
  }

  const share = (amount: number) => amount / totalCents;

  const toSlice = (id: string, amount: number, children: Map<string, number>): CategorySlice => {
    const category = byId.get(id);
    return {
      id,
      name: category?.name ?? (id === UNCATEGORIZED_ID ? "Sem categoria" : "?"),
      icon: category?.icon ?? DEFAULT_ICON,
      color: category?.color ?? NEUTRAL,
      amountCents: amount,
      share: share(amount),
      children: [...children.entries()]
        .map(([childId, childAmount]) =>
          toSlice(childId, childAmount, new Map<string, number>()),
        )
        .sort((a, b) => b.amountCents - a.amountCents),
    };
  };

  const all = [...roots.entries()]
    .map(([id, entry]) => toSlice(id, entry.total, entry.children))
    .sort((a, b) => b.amountCents - a.amountCents);

  // Além do topN, tudo vira "Outras": mais de ~7 classes coloridas param de
  // ser distinguíveis, e o rabo longo não ajuda a decidir nada.
  if (all.length <= topN + 1) return { totalCents, slices: all };

  const top = all.slice(0, topN);
  const tail = all.slice(topN);
  const tailTotal = tail.reduce((sum, slice) => sum + slice.amountCents, 0);

  return {
    totalCents,
    slices: [
      ...top,
      {
        id: OTHERS_ID,
        name: `Outras (${tail.length})`,
        icon: DEFAULT_ICON,
        color: NEUTRAL,
        amountCents: tailTotal,
        share: share(tailTotal),
        children: tail,
      },
    ],
  };
}
