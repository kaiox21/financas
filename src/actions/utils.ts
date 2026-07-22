import { z } from "zod";

import { getAuthClaims } from "@/lib/supabase/server";
import { parseAmountToCents } from "@/lib/money";

export { emptyState, failure, success, type FormState } from "@/lib/form-state";

export async function requireUserId(): Promise<string> {
  const claims = await getAuthClaims();
  if (!claims?.sub) throw new Error("Sessão expirada. Faça login novamente.");
  return claims.sub;
}

/** Campo de dinheiro vindo de um `<input>`: "1.234,56" → 123456 centavos. */
export const moneyField = z.string().transform((raw, ctx) => {
  const cents = parseAmountToCents(raw);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Valor inválido" });
    return z.NEVER;
  }
  return cents;
});

/** Dinheiro que precisa ser positivo (valor de transação, limite de cartão). */
export const positiveMoneyField = moneyField.refine((cents) => cents > 0, {
  message: "O valor precisa ser maior que zero",
});

/** Primeira mensagem de erro de um ZodError, para exibir no formulário. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}
