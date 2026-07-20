import { createClient } from "@/lib/supabase/server";
import type { RecurringTransaction } from "@/types/database";

export async function listRecurring(): Promise<RecurringTransaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .order("active", { ascending: false })
    .order("day_of_month");

  if (error) throw error;
  return data;
}
