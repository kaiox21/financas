import { describe, expect, it } from "vitest";
import { formatBRL, formatBRLShort, parseAmountToCents, splitInstallments } from "./money";

// O separador de milhar do pt-BR no Node é NBSP em alguns ambientes; normaliza.
const norm = (s: string) => s.replace(/ /g, " ");

describe("formatBRL", () => {
  it("formata valores em reais", () => {
    expect(norm(formatBRL(123456))).toBe("R$ 1.234,56");
    expect(norm(formatBRL(0))).toBe("R$ 0,00");
    expect(norm(formatBRL(-5000))).toBe("-R$ 50,00");
  });
});

describe("formatBRLShort", () => {
  it("abrevia milhares e milhões", () => {
    expect(formatBRLShort(150000)).toBe("R$ 1,5 mil");
    expect(formatBRLShort(250000000)).toBe("R$ 2,5 mi");
    expect(norm(formatBRLShort(9990))).toBe("R$ 99,90");
  });
});

describe("parseAmountToCents", () => {
  it("interpreta formato brasileiro", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
    expect(parseAmountToCents("R$ 1.234,56")).toBe(123456);
    expect(parseAmountToCents("1234,56")).toBe(123456);
    expect(parseAmountToCents("0,99")).toBe(99);
    expect(parseAmountToCents("1234,5")).toBe(123450);
  });

  it("interpreta ponto como decimal quando não há vírgula", () => {
    expect(parseAmountToCents("1234.56")).toBe(123456);
    expect(parseAmountToCents("12.5")).toBe(1250);
  });

  it("trata ponto como milhar quando sobram 3 dígitos", () => {
    expect(parseAmountToCents("1.234")).toBe(123400);
    expect(parseAmountToCents("10.000")).toBe(1000000);
  });

  it("aceita inteiros e negativos", () => {
    expect(parseAmountToCents("50")).toBe(5000);
    expect(parseAmountToCents("-50")).toBe(-5000);
  });

  it("rejeita entradas sem dígitos", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("R$")).toBeNull();
  });
});

describe("splitInstallments", () => {
  it("divide igualmente quando possível", () => {
    expect(splitInstallments(120000, 12)).toEqual(Array(12).fill(10000));
  });

  it("joga o resto de centavos na primeira parcela", () => {
    const parts = splitInstallments(10000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("preserva o total em qualquer divisão", () => {
    for (const n of [1, 2, 5, 7, 11, 18, 24]) {
      const total = 99991;
      expect(splitInstallments(total, n).reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
