-- =============================================================
-- 0005_reinstall_purchase — trocar o número de parcelas de uma compra
--
-- Reparcelar mexe em várias linhas de uma vez: apaga as parcelas que ainda não
-- venceram, renumera as que ficam e insere as novas. Se isso rodasse como três
-- chamadas soltas do app, uma falha no meio deixaria a compra sem parcelas ou
-- com parcelas duplicadas — dado financeiro corrompido, e silenciosamente.
--
-- Uma função resolve tudo numa transação só: ou aplica inteiro, ou nada.
--
-- O QUE decidir (quanto travar, como dividir) continua no app, em
-- `lib/installments.ts`, que é puro e testado. Aqui só se APLICA o plano.
--
-- SECURITY INVOKER (padrão): roda como o usuário chamador, então a RLS de
-- `transactions` continua valendo — ninguém alcança parcela de outro usuário.
-- =============================================================

create function reinstall_purchase(
  p_group_id uuid,
  p_delete_ids uuid[],
  p_keep_ids uuid[],
  p_installment_total smallint,
  p_new_rows jsonb
) returns void
language plpgsql as $$
declare
  tpl record;
begin
  -- O que descreve a compra (descrição, categoria, cartão) é o mesmo em todas
  -- as parcelas: herdar de uma delas evita o app ter que reenviar tudo.
  select t.description, t.type, t.payment_method, t.category_id,
         t.credit_card_id, t.affects_balance
    into tpl
    from transactions t
   where t.installment_group_id = p_group_id
   order by t.installment_number
   limit 1;

  if not found then
    raise exception 'Parcelamento não encontrado';
  end if;

  delete from transactions where id = any(p_delete_ids);

  -- Sem total, a compra deixou de ser parcelada: os três campos voltam a nulo.
  if p_installment_total is null then
    update transactions
       set installment_group_id = null,
           installment_number = null,
           installment_total = null
     where id = any(p_keep_ids);
  else
    update transactions
       set installment_total = p_installment_total
     where id = any(p_keep_ids);
  end if;

  insert into transactions (
    user_id, description, amount_cents, type, date, payment_method,
    category_id, account_id, credit_card_id, invoice_month,
    installment_group_id, installment_number, installment_total, affects_balance
  )
  select
    auth.uid(),
    tpl.description,
    (item->>'amount_cents')::bigint,
    tpl.type,
    (item->>'date')::date,
    tpl.payment_method,
    tpl.category_id,
    null,
    tpl.credit_card_id,
    (item->>'invoice_month')::date,
    case when p_installment_total is null then null else p_group_id end,
    (item->>'installment_number')::smallint,
    p_installment_total,
    tpl.affects_balance
  from jsonb_array_elements(coalesce(p_new_rows, '[]'::jsonb)) as item;
end;
$$;

grant execute on function reinstall_purchase(uuid, uuid[], uuid[], smallint, jsonb)
  to authenticated;
