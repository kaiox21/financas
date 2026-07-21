-- =============================================================
-- 0003_affects_balance — pagamento que não mexe no saldo
--
-- Fatura quitada antes de você começar a usar o app (ou paga por uma conta
-- que você não acompanha aqui) precisa aparecer como PAGA sem descontar do
-- saldo atual — senão conta o dinheiro duas vezes, porque o "saldo atual"
-- que você cadastrou já refletia esse pagamento.
--
-- `affects_balance = false` mantém a transação (fatura segue paga) mas a tira
-- do cálculo do saldo da conta.
--
-- ALTER não-destrutivo: preserva os dados já cadastrados.
-- =============================================================

alter table transactions
  add column affects_balance boolean not null default true;
