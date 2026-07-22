import { withReturns, type InvestmentWithReturn } from "@/lib/investment-summary";
import { getInvestments, getTransactions } from "@/lib/queries/request-cache";

export async function listInvestments(): Promise<InvestmentWithReturn[]> {
  const [investments, transactions] = await Promise.all([
    getInvestments(),
    getTransactions(),
  ]);

  const contributions = transactions.filter((t) => t.investment_id);
  return withReturns(investments, contributions);
}
