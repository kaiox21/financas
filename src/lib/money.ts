/**
 * Todo valor monetário do app é um inteiro de centavos.
 * R$ 1.234,56 => 123456. Nunca usar float para dinheiro.
 */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlNoSymbol = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** "1.234,56" — sem o símbolo, para inputs. */
export function formatAmount(cents: number): string {
  return brlNoSymbol.format(cents / 100);
}

/** Versão curta para eixos de gráfico: R$ 1,2 mil / R$ 3,4 mi */
export function formatBRLShort(cents: number): string {
  const value = cents / 100;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")} mil`;
  return brl.format(value);
}

/**
 * Converte o que o usuário digitou em centavos.
 * Aceita "1.234,56", "1234,56", "1234.56", "1234", "R$ 1.234,56".
 * Retorna null quando não dá para interpretar.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const negative = cleaned.startsWith("-");
  let digits = cleaned.replace(/-/g, "");

  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  const separator = Math.max(lastComma, lastDot);

  let decimals = "";
  if (separator !== -1) {
    const tail = digits.slice(separator + 1);
    // Só é separador decimal se sobrarem 1 ou 2 dígitos depois dele.
    // "1.234" é milhar; "1.23" é decimal.
    if (/^\d{1,2}$/.test(tail)) {
      decimals = tail.padEnd(2, "0");
      digits = digits.slice(0, separator);
    }
  }

  const whole = digits.replace(/\D/g, "");
  if (!whole && !decimals) return null;

  const cents = Number(`${whole || "0"}${decimals || "00"}`);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** Divide um total em N parcelas; o resto de centavos vai na primeira. */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (count < 1) throw new Error("Número de parcelas deve ser >= 1");
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base));
}
