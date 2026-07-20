/**
 * Datas do app são strings "YYYY-MM-DD" (date-only) e meses são "YYYY-MM-01".
 * Trabalhar com strings evita a classe inteira de bugs de fuso horário
 * (um `new Date("2026-07-20")` em UTC vira 19/07 no horário de Brasília).
 */

export const TIMEZONE = "America/Sao_Paulo";

export type DateStr = string; // YYYY-MM-DD
export type MonthStr = string; // YYYY-MM-01

/** Hoje no fuso de São Paulo, como "YYYY-MM-DD". */
export function today(): DateStr {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentMonth(): MonthStr {
  return monthOf(today());
}

export function monthOf(date: DateStr): MonthStr {
  return `${date.slice(0, 7)}-01`;
}

export function parseParts(date: DateStr): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Soma meses a uma data, limitando o dia ao último dia do mês de destino. */
export function addMonths(date: DateStr, months: number): DateStr {
  const { year, month, day } = parseParts(date);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(newYear, newMonth));
  return `${newYear}-${pad(newMonth)}-${pad(clampedDay)}`;
}

export function addMonthsToMonth(month: MonthStr, delta: number): MonthStr {
  return monthOf(addMonths(month, delta));
}

/** Diferença em meses entre dois meses (b - a). */
export function monthsBetween(a: MonthStr, b: MonthStr): number {
  const pa = parseParts(a);
  const pb = parseParts(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

/** Primeiro e último dia (inclusive) do mês. */
export function monthRange(month: MonthStr): { start: DateStr; end: DateStr } {
  const { year, month: m } = parseParts(month);
  return {
    start: `${year}-${pad(m)}-01`,
    end: `${year}-${pad(m)}-${pad(daysInMonth(year, m))}`,
  };
}

/** Monta uma data a partir de ano/mês de um MonthStr e um dia, com clamp. */
export function dayInMonth(month: MonthStr, day: number): DateStr {
  const { year, month: m } = parseParts(month);
  return `${year}-${pad(m)}-${pad(Math.min(day, daysInMonth(year, m)))}`;
}

/** Lista de meses de `from` até `to`, inclusive. */
export function monthSequence(from: MonthStr, to: MonthStr): MonthStr[] {
  const count = monthsBetween(from, to);
  if (count < 0) return [];
  return Array.from({ length: count + 1 }, (_, i) => addMonthsToMonth(from, i));
}

// ---- Formatação -------------------------------------------------------

function asUTCDate(date: DateStr): Date {
  const { year, month, day } = parseParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

/** "20/07/2026" */
export function formatDateBR(date: DateStr): string {
  const { year, month, day } = parseParts(date);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** "20 de jul" */
export function formatDayMonth(date: DateStr): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  })
    .format(asUTCDate(date))
    .replace(".", "");
}

/** "julho de 2026" */
export function formatMonthLong(month: MonthStr): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(asUTCDate(month));
}

/** "jul/26" — para eixos de gráfico */
export function formatMonthShort(month: MonthStr): string {
  const { year } = parseParts(month);
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "short",
  })
    .format(asUTCDate(month))
    .replace(".", "");
  return `${label}/${String(year).slice(2)}`;
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { year, month, day } = parseParts(date);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}
