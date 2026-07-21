-- =============================================================
-- 0002_budget — linhas de orçamento para a projeção
--
-- Cada linha é um custo mensal planejado por categoria ("Alimentação
-- R$ 800"). A projeção soma todas em cada mês futuro, junto com as
-- recorrentes. Não são transações: nunca entram no saldo nem no histórico,
-- só na projeção.
-- =============================================================

-- Substitui a abordagem anterior (número único em user_settings).
drop table if exists user_settings cascade;

create table budget_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  description text check (description is null or length(btrim(description)) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index budget_lines_user_idx on budget_lines (user_id);

alter table budget_lines enable row level security;

create policy budget_lines_owner on budget_lines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
