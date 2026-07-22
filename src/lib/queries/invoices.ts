import { today } from "@/lib/dates";
import {
  buildInvoices,
  limitStatus,
  usedLimitCents,
  type Invoice,
  type LimitStatus,
} from "@/lib/invoice-summary";
import { getCreditCards, getTransactions } from "@/lib/queries/request-cache";
import type { CreditCard, Transaction } from "@/types/database";

export type CardWithInvoices = CreditCard & {
  invoices: Invoice[];
  usedCents: number;
  availableCents: number;
  status: LimitStatus;
  /** A fatura que ainda aceita compras — é a que o usuário quer ver primeiro. */
  openInvoice: Invoice | null;
  /** A mais antiga em aberto: é essa que precisa ser paga. */
  nextDueInvoice: Invoice | null;
};

export async function listCardsWithInvoices(): Promise<CardWithInvoices[]> {
  const reference = today();

  const [cards, transactions] = await Promise.all([getCreditCards(), getTransactions()]);

  const byCard = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!transaction.credit_card_id) continue;
    const list = byCard.get(transaction.credit_card_id);
    if (list) list.push(transaction);
    else byCard.set(transaction.credit_card_id, [transaction]);
  }

  return cards.map((card) => {
    const cycle = { closingDay: card.closing_day, dueDay: card.due_day };
    const invoices = buildInvoices(byCard.get(card.id) ?? [], cycle, reference);
    const usedCents = usedLimitCents(invoices);

    // `invoices` vem do mês mais recente para o mais antigo. Parcelas criam
    // faturas futuras, que também estão "abertas"; a fatura aberta que
    // interessa é a que está acumulando AGORA — a aberta mais próxima, não a
    // mais distante. Entre as abertas (ordem decrescente), é a última.
    const openInvoices = invoices.filter((invoice) => invoice.isOpen);

    return {
      ...card,
      invoices,
      usedCents,
      availableCents: card.limit_cents - usedCents,
      status: limitStatus(usedCents, card.limit_cents),
      openInvoice: openInvoices.at(-1) ?? null,
      nextDueInvoice:
        [...invoices].reverse().find((invoice) => !invoice.isPaid && !invoice.isOpen) ??
        null,
    };
  });
}
