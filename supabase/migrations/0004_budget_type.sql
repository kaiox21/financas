-- =============================================================
-- 0004_budget_type — linhas de orçamento podem ser entrada ou saída
--
-- Até aqui toda linha de orçamento era custo (saída). Agora a projeção também
-- aceita receitas recorrentes planejadas (freela, bônus, aluguel recebido).
--
-- Default 'expense' preserva as linhas já cadastradas como saída.
-- ALTER não-destrutivo.
-- =============================================================

alter table budget_lines
  add column type tx_type not null default 'expense';
