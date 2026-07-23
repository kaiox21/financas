/**
 * Reparcelamento de uma compra no crédito já lançada.
 *
 * Trocar o número de parcelas não é recriar a compra do zero: parcelas que já
 * caíram em **fatura paga** são intocáveis. Aquele dinheiro já saiu da conta, e
 * o pagamento foi gravado contra o total daquele mês de fatura — reescrever o
 * valor da parcela faria a fatura quitada voltar a ter saldo devedor.
 *
 * Então o plano é sempre: preservar as parcelas travadas, apagar as que ainda
 * não venceram e redistribuir o restante do total nas novas parcelas.
 */

import { addMonths, addMonthsToMonth, type DateStr, type MonthStr } from "./dates";
import { splitInstallments } from "./money";

/** Parcela existente, na forma mínima que o plano precisa. */
export type ParcelRow = {
  id: string;
  amount_cents: number;
  date: DateStr;
  invoice_month: MonthStr | null;
  installment_number: number | null;
};

export type NewParcel = {
  amount_cents: number;
  date: DateStr;
  invoice_month: MonthStr;
  installment_number: number | null;
  installment_total: number | null;
};

export type ReinstallmentPlan = {
  /** Parcelas travadas (fatura paga): ficam como estão, só renumera o total. */
  keepIds: string[];
  /** Parcelas ainda não pagas: saem para dar lugar às novas. */
  deleteIds: string[];
  /** As parcelas que substituem as apagadas. */
  create: NewParcel[];
  /**
   * Novo `installment_total`, aplicado também às travadas. `null` quando a
   * compra deixa de ser parcelada (1x) — aí os três campos são limpos.
   */
  installmentTotal: number | null;
  lockedCount: number;
  /** Total já comprometido nas parcelas travadas. */
  lockedCents: number;
};

export type PlanResult =
  | { ok: true; plan: ReinstallmentPlan }
  | { ok: false; error: string };

/**
 * Monta o plano de reparcelamento.
 *
 * `paidMonths` são os meses de fatura já quitados — quem decide o que está
 * travado. Fica como parâmetro (e não consulta aqui dentro) para a função
 * seguir pura e testável.
 */
export function planReinstallment({
  parcels,
  paidMonths,
  newCount,
  totalCents,
}: {
  parcels: ParcelRow[];
  paidMonths: Set<MonthStr>;
  newCount: number;
  totalCents: number;
}): PlanResult {
  if (parcels.length === 0) return { ok: false, error: "Compra não encontrada." };
  if (newCount < 1) return { ok: false, error: "Número de parcelas inválido." };
  if (totalCents <= 0) return { ok: false, error: "O valor total precisa ser maior que zero." };

  const ordered = [...parcels].sort(
    (a, b) => (a.installment_number ?? 1) - (b.installment_number ?? 1),
  );

  if (ordered.some((parcel) => !parcel.invoice_month)) {
    return { ok: false, error: "Parcelamento só existe em compra no crédito." };
  }

  // Trava até a ÚLTIMA parcela paga, não só o prefixo: se uma fatura mais
  // adiante foi adiantada, as do meio também não podem ser reescritas sem
  // deixar buraco na sequência.
  let lastPaid = -1;
  ordered.forEach((parcel, index) => {
    if (parcel.invoice_month && paidMonths.has(parcel.invoice_month)) lastPaid = index;
  });

  const lockedCount = lastPaid + 1;
  const locked = ordered.slice(0, lockedCount);
  const unlocked = ordered.slice(lockedCount);
  const lockedCents = locked.reduce((sum, parcel) => sum + parcel.amount_cents, 0);

  if (newCount < lockedCount) {
    return {
      ok: false,
      error:
        lockedCount === 1
          ? "1 parcela já está em fatura paga — não dá para reduzir abaixo disso."
          : `${lockedCount} parcelas já estão em faturas pagas — não dá para reduzir abaixo disso.`,
    };
  }

  const remainingCents = totalCents - lockedCents;
  if (remainingCents < 0) {
    return {
      ok: false,
      error: "O total é menor do que já foi pago em parcelas quitadas.",
    };
  }

  const tailCount = newCount - lockedCount;
  if (tailCount === 0 && remainingCents > 0) {
    return {
      ok: false,
      error: "Sobrou valor sem parcela para receber. Aumente o número de parcelas.",
    };
  }

  // 1x deixa de ser parcelamento: os três campos voltam a ser nulos.
  const installmentTotal = newCount >= 2 ? newCount : null;

  // Onde a nova sequência começa. Sem nada travado, mantém a data e a fatura
  // originais da compra; com parcelas travadas, segue o mês seguinte à última.
  const anchor =
    lockedCount === 0
      ? { date: ordered[0].date, month: ordered[0].invoice_month! }
      : {
          date: addMonths(locked[lockedCount - 1].date, 1),
          month: addMonthsToMonth(locked[lockedCount - 1].invoice_month!, 1),
        };

  const amounts = tailCount > 0 ? splitInstallments(remainingCents, tailCount) : [];

  const create: NewParcel[] = amounts.map((amount, index) => ({
    amount_cents: amount,
    date: addMonths(anchor.date, index),
    invoice_month: addMonthsToMonth(anchor.month, index),
    installment_number: installmentTotal ? lockedCount + index + 1 : null,
    installment_total: installmentTotal,
  }));

  return {
    ok: true,
    plan: {
      keepIds: locked.map((parcel) => parcel.id),
      deleteIds: unlocked.map((parcel) => parcel.id),
      create,
      installmentTotal,
      lockedCount,
      lockedCents,
    },
  };
}
