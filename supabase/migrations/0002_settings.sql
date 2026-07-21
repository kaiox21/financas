-- =============================================================
-- 0002_settings — preferências do usuário para a projeção
-- Uma linha por usuário. Hoje guarda só o gasto variável estimado,
-- mas fica pronta para outras preferências.
-- =============================================================

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Gasto variável estimado por mês (centavos). Null = usar a média histórica.
  variable_estimate_cents bigint check (variable_estimate_cents is null or variable_estimate_cents >= 0),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy user_settings_owner on user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger user_settings_touch_updated_at
  before update on user_settings
  for each row execute function touch_updated_at();
