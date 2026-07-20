import { describe, expect, it } from "vitest";
import {
  addMonths,
  addMonthsToMonth,
  dayInMonth,
  daysInMonth,
  formatDateBR,
  formatMonthLong,
  formatMonthShort,
  isValidDate,
  monthOf,
  monthRange,
  monthSequence,
  monthsBetween,
} from "./dates";

describe("addMonths", () => {
  it("soma e subtrai meses", () => {
    expect(addMonths("2026-07-20", 1)).toBe("2026-08-20");
    expect(addMonths("2026-07-20", -1)).toBe("2026-06-20");
  });

  it("vira o ano corretamente", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("limita o dia ao último dia do mês de destino", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // bissexto
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});

describe("monthsBetween", () => {
  it("conta a diferença em meses", () => {
    expect(monthsBetween("2026-01-01", "2026-07-01")).toBe(6);
    expect(monthsBetween("2026-07-01", "2026-01-01")).toBe(-6);
    expect(monthsBetween("2025-11-01", "2026-02-01")).toBe(3);
  });
});

describe("monthRange", () => {
  it("devolve o primeiro e o último dia", () => {
    expect(monthRange("2026-07-01")).toEqual({ start: "2026-07-01", end: "2026-07-31" });
    expect(monthRange("2026-02-01")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthRange("2024-02-01")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
});

describe("dayInMonth", () => {
  it("limita o dia ao tamanho do mês", () => {
    expect(dayInMonth("2026-07-01", 10)).toBe("2026-07-10");
    expect(dayInMonth("2026-02-01", 31)).toBe("2026-02-28");
  });
});

describe("monthSequence", () => {
  it("gera a sequência inclusive", () => {
    expect(monthSequence("2026-11-01", "2027-01-01")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ]);
  });

  it("devolve vazio quando o fim é antes do início", () => {
    expect(monthSequence("2026-05-01", "2026-04-01")).toEqual([]);
  });
});

describe("helpers", () => {
  it("monthOf e addMonthsToMonth", () => {
    expect(monthOf("2026-07-20")).toBe("2026-07-01");
    expect(addMonthsToMonth("2026-12-01", 2)).toBe("2027-02-01");
  });

  it("daysInMonth", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 7)).toBe(31);
  });

  it("isValidDate", () => {
    expect(isValidDate("2026-07-20")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("20/07/2026")).toBe(false);
  });
});

describe("formatação", () => {
  it("formata sem deslocar o dia por fuso horário", () => {
    expect(formatDateBR("2026-07-01")).toBe("01/07/2026");
    expect(formatMonthLong("2026-07-01")).toBe("julho de 2026");
    expect(formatMonthShort("2026-07-01")).toBe("jul/26");
  });
});
