-- =============================================================
-- 0001_init — schema inicial do app de finanças pessoais
-- Convenções: valores em centavos (bigint), datas em `date` (sem hora),
-- RLS em todas as tabelas com user_id = auth.uid().
-- =============================================================

-- ---------- Enums ----------
create type tx_type as enum ('income', 'expense');
create type payment_method as enum ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia');
create type investment_type as enum ('renda_fixa', 'renda_variavel', 'reserva');

-- ---------- Categorias ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  icon text not null default 'circle',
  color text not null default '#6b7280' check (color ~ '^#[0-9a-fA-F]{6}$'),
  type tx_type not null,
  parent_id uuid references categories(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Nome único por usuário dentro do mesmo tipo e mesmo pai.
create unique index categories_unique_name_idx
  on categories (
    user_id,
    type,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(name))
  );

create index categories_parent_idx on categories (user_id, parent_id);

-- Máximo 2 níveis: o pai de uma subcategoria não pode ter pai.
create function enforce_category_depth() returns trigger
language plpgsql as $$
declare
  parent_has_parent boolean;
  parent_type tx_type;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Uma categoria não pode ser pai de si mesma';
  end if;

  select c.parent_id is not null, c.type
    into parent_has_parent, parent_type
    from categories c where c.id = new.parent_id;

  if parent_has_parent then
    raise exception 'Subcategoria só pode ter um nível (máximo 2)';
  end if;

  if parent_type is distinct from new.type then
    raise exception 'Subcategoria precisa ter o mesmo tipo da categoria pai';
  end if;

  return new;
end;
$$;

create trigger categories_depth_check
  before insert or update of parent_id, type on categories
  for each row execute function enforce_category_depth();

-- ---------- Contas ----------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  initial_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index accounts_user_idx on accounts (user_id) where not archived;

-- ---------- Cartões de crédito ----------
create table credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  limit_cents bigint not null check (limit_cents >= 0),
  closing_day smallint not null check (closing_day between 1 and 28),
  due_day smallint not null check (due_day between 1 and 28),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index credit_cards_user_idx on credit_cards (user_id) where not archived;

-- ---------- Recorrentes (regras) ----------
create table recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0),
  type tx_type not null,
  category_id uuid references categories(id) on delete set null,
  payment_method payment_method not null,
  account_id uuid references accounts(id) on delete set null,
  credit_card_id uuid references credit_cards(id) on delete set null,
  day_of_month smallint not null check (day_of_month between 1 and 28),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint recurring_period_valid check (end_date is null or end_date >= start_date),
  constraint recurring_credit_needs_card check (payment_method <> 'credito' or credit_card_id is not null),
  constraint recurring_non_credit_needs_account check (payment_method = 'credito' or account_id is not null)
);

create index recurring_active_idx on recurring_transactions (user_id, active, start_date);

-- ---------- Investimentos ----------
create table investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  type investment_type not null,
  current_value_cents bigint not null default 0 check (current_value_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investments_user_idx on investments (user_id);

create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger investments_touch_updated_at
  before update on investments
  for each row execute function touch_updated_at();

-- ---------- Transações ----------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0),  -- o sinal vem do `type`
  type tx_type not null,
  date date not null,
  category_id uuid references categories(id) on delete set null,
  payment_method payment_method not null,
  account_id uuid references accounts(id) on delete set null,
  credit_card_id uuid references credit_cards(id) on delete set null,
  invoice_month date,                                     -- 1º dia do mês da fatura
  recurring_id uuid references recurring_transactions(id) on delete set null,
  installment_group_id uuid,
  installment_number smallint check (installment_number >= 1),
  installment_total smallint check (installment_total >= 2),
  investment_id uuid references investments(id) on delete set null,
  is_invoice_payment boolean not null default false,
  created_at timestamptz not null default now(),

  -- crédito debita o cartão e cai numa fatura
  constraint tx_credit_needs_card
    check (payment_method <> 'credito' or (credit_card_id is not null and invoice_month is not null)),
  -- qualquer outro meio sai/entra de uma conta
  constraint tx_non_credit_needs_account
    check (payment_method = 'credito' or account_id is not null),
  -- invoice_month é sempre o 1º dia do mês
  constraint tx_invoice_month_is_first_day
    check (invoice_month is null or extract(day from invoice_month) = 1),
  -- pagamento de fatura: saída da conta, referente a um cartão e a uma fatura
  constraint tx_invoice_payment_shape
    check (
      not is_invoice_payment
      or (type = 'expense'
          and payment_method <> 'credito'
          and credit_card_id is not null
          and invoice_month is not null)
    ),
  -- parcelas: os três campos andam juntos e o número não passa do total
  constraint tx_installment_fields_together
    check (
      (installment_group_id is null and installment_number is null and installment_total is null)
      or (installment_group_id is not null and installment_number is not null
          and installment_total is not null and installment_number <= installment_total)
    ),
  -- aporte de investimento é sempre uma saída de caixa
  constraint tx_investment_is_expense
    check (investment_id is null or type = 'expense')
);

create index transactions_month_idx on transactions (user_id, date desc);
create index transactions_invoice_idx on transactions (user_id, credit_card_id, invoice_month);
create index transactions_recurring_idx on transactions (user_id, recurring_id, date);
create index transactions_account_idx on transactions (user_id, account_id);
create index transactions_category_idx on transactions (user_id, category_id, date);
create index transactions_installment_idx on transactions (installment_group_id)
  where installment_group_id is not null;

-- Idempotência da materialização de recorrentes: uma ocorrência por regra/data.
create unique index transactions_recurring_occurrence_idx
  on transactions (recurring_id, date)
  where recurring_id is not null;

-- =============================================================
-- RLS — dono é o único que enxerga/escreve
-- =============================================================
alter table categories             enable row level security;
alter table accounts               enable row level security;
alter table credit_cards           enable row level security;
alter table recurring_transactions enable row level security;
alter table investments            enable row level security;
alter table transactions           enable row level security;

create policy categories_owner on categories
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy accounts_owner on accounts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy credit_cards_owner on credit_cards
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recurring_owner on recurring_transactions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy investments_owner on investments
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transactions_owner on transactions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =============================================================
-- Seed de categorias padrão (idempotente)
-- =============================================================
create function seed_default_categories(target_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into categories (user_id, name, icon, color, type, is_default)
  values
    (target_user, 'Moradia',       'house',          '#f97316', 'expense', true),
    (target_user, 'Alimentação',   'utensils',       '#ef4444', 'expense', true),
    (target_user, 'Transporte',    'car',            '#3b82f6', 'expense', true),
    (target_user, 'Saúde',         'heart-pulse',    '#ec4899', 'expense', true),
    (target_user, 'Lazer',         'party-popper',   '#a855f7', 'expense', true),
    (target_user, 'Educação',      'graduation-cap', '#14b8a6', 'expense', true),
    (target_user, 'Investimentos', 'piggy-bank',     '#22c55e', 'expense', true),
    (target_user, 'Assinaturas',   'repeat',         '#6366f1', 'expense', true),
    (target_user, 'Outros',        'circle-dashed',  '#6b7280', 'expense', true),
    (target_user, 'Salário',       'banknote',       '#22c55e', 'income',  true),
    (target_user, 'Freela',        'briefcase',      '#0ea5e9', 'income',  true),
    (target_user, 'Rendimentos',   'trending-up',    '#84cc16', 'income',  true),
    (target_user, 'Outros',        'circle-dashed',  '#6b7280', 'income',  true)
  on conflict do nothing;
end;
$$;

grant execute on function seed_default_categories(uuid) to authenticated;

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Usuários que já existiam antes desta migration:
select seed_default_categories(id) from auth.users;
