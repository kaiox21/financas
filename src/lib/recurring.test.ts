import { describe, expect, it } from "vitest";

import { futureOccurrences, missingOccurrences, occurrenceDates } from "./recurring";

const aluguel = {
  day_of_month: 10,
  start_date: "2026-03-10",
  end_date: null,
  active: true,
};

describe("occurrenceDates", () => {
  it("gera uma ocorrência por mês, do início até o mês pedido", () => {
    expect(occurrenceDates(aluguel, "2026-06-01")).toEqual([
      "2026-03-10",
      "2026-04-10",
      "2026-05-10",
      "2026-06-10",
    ]);
  });

  it("não gera nada antes do início", () => {
    expect(occurrenceDates(aluguel, "2026-02-01")).toEqual([]);
  });

  it("respeita o fim da regra", () => {
    const comFim = { ...aluguel, end_date: "2026-05-01" };
    expect(occurrenceDates(comFim, "2026-08-01")).toEqual(["2026-03-10", "2026-04-10"]);
  });

  it("regra inativa não gera nada", () => {
    expect(occurrenceDates({ ...aluguel, active: false }, "2026-06-01")).toEqual([]);
  });

  it("começar depois do dia do mês pula a primeira ocorrência", () => {
    // Regra do dia 10 criada em 20/03: março já passou, começa em abril.
    const rule = { ...aluguel, start_date: "2026-03-20" };
    expect(occurrenceDates(rule, "2026-05-01")).toEqual(["2026-04-10", "2026-05-10"]);
  });

  it("vira o ano", () => {
    const rule = { ...aluguel, start_date: "2026-11-10" };
    expect(occurrenceDates(rule, "2027-01-01")).toEqual([
      "2026-11-10",
      "2026-12-10",
      "2027-01-10",
    ]);
  });
});

describe("missingOccurrences", () => {
  it("ignora o que já foi materializado", () => {
    const missing = missingOccurrences(
      aluguel,
      ["2026-03-10", "2026-04-10"],
      "2026-06-01",
    );
    expect(missing).toEqual(["2026-05-10", "2026-06-10"]);
  });

  it("rodar de novo sem nada novo não devolve nada — a operação é repetível", () => {
    const todas = occurrenceDates(aluguel, "2026-06-01");
    expect(missingOccurrences(aluguel, todas, "2026-06-01")).toEqual([]);
  });

  it("uma ocorrência excluída pelo usuário volta a aparecer como pendente", () => {
    // Consequência conhecida: excluir a ocorrência de abril e recarregar o app
    // recria abril. Para parar de gerar, o caminho é desativar ou encerrar a regra.
    const missing = missingOccurrences(
      aluguel,
      ["2026-03-10", "2026-05-10", "2026-06-10"],
      "2026-06-01",
    );
    expect(missing).toEqual(["2026-04-10"]);
  });
});

describe("futureOccurrences", () => {
  it("só devolve meses depois do mês de referência", () => {
    expect(futureOccurrences(aluguel, "2026-06-01", 3)).toEqual([
      "2026-07-10",
      "2026-08-10",
      "2026-09-10",
    ]);
  });

  it("para no fim da regra", () => {
    const comFim = { ...aluguel, end_date: "2026-08-01" };
    expect(futureOccurrences(comFim, "2026-06-01", 6)).toEqual(["2026-07-10"]);
  });
});
