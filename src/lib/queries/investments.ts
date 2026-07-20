import { withReturns, type InvestmentWithReturn } from "@/lib/investment-summary";
import { createClient } from "@/lib/supabase/server";

export async function listInvestments(): Promise<InvestmentWithReturn[]> {
  const supabase = await createClient();

  const [investments, contributions] = await Promise.all([
    supabase.from("investments").select("*").order("name"),
    supabase
      .from("transactions")
      .select("investment_id, amount_cents, type")
      .not("investment_id", "is", null),
  ]);

  if (investments.error) throw investments.error;
  if (contributions.error) throw contributions.error;

  return withReturns(investments.data, contributions.data);
}
