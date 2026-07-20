/**
 * Recorrentes são **regra + materialização**: a regra diz "todo dia 10",
 * e as ocorrências até o mês corrente viram transações de verdade. Meses
 * futuros ficam virtuais — só a projeção olha para eles.
 *
 * Isso permite editar ou excluir uma ocorrência específica (ela já é uma
 * transação comum) sem quebrar a regra.
 */

import {
  addMonthsToMonth,
  dayInMonth,
  monthOf,
  monthSequence,
  type DateStr,
  type MonthStr,
} from "./dates";

export type RecurringRule = {
  day_of_month: number;
  start_date: DateStr;
  end_date: DateStr | null;
  active: boolean;
};

/**
 * Todas as datas em que a regra deve gerar lançamento, do início até
 * `throughMonth` (inclusive). `day_of_month` é 1–28, então nunca precisa clamp.
 */
export function occurrenceDates(rule: RecurringRule, throughMonth: MonthStr): DateStr[] {
  if (!rule.active) return [];

  const firstMonth = monthOf(rule.start_date);
  if (firstMonth > throughMonth) return [];

  return monthSequence(firstMonth, throughMonth)
    .map((month) => dayInMonth(month, rule.day_of_month))
    .filter((date) => date >= rule.start_date)
    .filter((date) => !rule.end_date || date <= rule.end_date);
}

/**
 * O que falta materializar: as ocorrências que ainda não existem como
 * transação. Quem já existe é ignorado — é isso que torna a operação
 * repetível a cada carregamento do app sem duplicar nada.
 */
export function missingOccurrences(
  rule: RecurringRule,
  existingDates: Iterable<DateStr>,
  throughMonth: MonthStr,
): DateStr[] {
  const existing = new Set(existingDates);
  return occurrenceDates(rule, throughMonth).filter((date) => !existing.has(date));
}

/**
 * Ocorrências futuras (depois do mês corrente) — virtuais, para a projeção.
 */
export function futureOccurrences(
  rule: RecurringRule,
  fromMonth: MonthStr,
  monthsAhead: number,
): DateStr[] {
  const through = addMonthsToMonth(fromMonth, monthsAhead);
  return occurrenceDates(rule, through).filter((date) => monthOf(date) > fromMonth);
}
