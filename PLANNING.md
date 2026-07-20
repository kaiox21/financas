# Planejamento — App de Controle Financeiro Pessoal

> Stack: Next.js 16 (App Router) + TypeScript · Tailwind CSS v4 + shadcn/ui · Supabase (Postgres + Auth) · Recharts · Vercel
> Poucos usuários com dados totalmente isolados, mobile-first, valores em R$.

## 1. Decisões de arquitetura (e por quê)

1. **Valores em centavos (`bigint`)** — nunca `float`/`numeric` com casas soltas. `R$ 1.234,56` = `123456`. Elimina erros de arredondamento; formatação com `Intl.NumberFormat('pt-BR', { currency: 'BRL' })`.
2. **Saldo de conta é computado, não armazenado** — `accounts.initial_balance_cents` + soma das transações da conta. Evita saldo dessincronizado (drift). O usuário informa o "saldo atual" no cadastro e isso vira o saldo inicial.
3. **Cartão de crédito não debita conta na hora** — compra no crédito recebe um `invoice_month` (calculado pelo dia de fechamento). A fatura é a soma das transações daquele mês de fatura. O **pagamento da fatura** é uma transação de saída na conta. Isso modela corretamente fluxo de caixa vs. limite.
4. **Recorrentes = regra + materialização** — `recurring_transactions` guarda a regra (dia do mês, valor, categoria). Ao abrir o app, transações são materializadas até o mês corrente (idempotente, com link `recurring_id`). Meses futuros ficam **virtuais** — usados só na projeção. Permite editar/excluir uma ocorrência sem quebrar a regra.
5. **Parcelamento gera todas as parcelas no ato** — 12x = 12 transações com `installment_group_id` comum, `installment_number/total`, cada uma caindo na fatura do mês certo. Editar/excluir oferece "só esta" ou "todas restantes".
6. **Subcategoria = `parent_id` na própria tabela `categories`** — evita tabela extra; 2 níveis no máximo.
7. **Sem tabela `users` própria** — `auth.users` do Supabase basta. **RLS em todas as tabelas** com `user_id = auth.uid()` isola completamente os usuários entre si: cada pessoa tem suas próprias contas, cartões, categorias e transações, sem nada compartilhado. Cadastro público desativado no dashboard — usuários são criados manualmente.
8. **Server Components para leitura, Server Actions + Zod para mutações** — sem API routes; menos código, type-safe de ponta a ponta.
9. **Datas como `date` (sem hora), timezone America/Sao_Paulo** — finanças pessoais são por dia; evita bugs de UTC virando o dia.
10. **Aporte de investimento = transação de saída com `investment_id`** — sai do fluxo de caixa e soma no valor aportado do investimento. `current_value_cents` é atualizado manualmente pelo usuário.
11. **Testes unitários (Vitest) só nas funções críticas** — dinheiro, cálculo de fatura/`invoice_month`, geração de parcelas, projeção. UI é validada manualmente por bloco.

## 2. Schema do banco  ✅ aplicado

O SQL final vive em [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — essa é a fonte da verdade,
não duplicar aqui. Aplicado no Supabase em 2026-07-20 e validado num Postgres 17 descartável
(as 10 constraints negativas rejeitam o que devem rejeitar).

Tabelas: `categories`, `accounts`, `credit_cards`, `recurring_transactions`, `investments`, `transactions`.
RLS `for all to authenticated using (user_id = (select auth.uid()))` em todas — o `select` faz o Postgres
avaliar `auth.uid()` uma vez por query em vez de por linha.

Invariantes que o banco garante (e que a UI não precisa reimplementar):
- Categoria tem no máximo 2 níveis, subcategoria herda o `type` do pai, nome único por (usuário, tipo, pai).
- Crédito exige `credit_card_id` + `invoice_month`; qualquer outro meio exige `account_id`.
- `invoice_month` é sempre o 1º dia do mês.
- Pagamento de fatura: `expense`, método ≠ crédito, com `credit_card_id` + `invoice_month`.
- Os três campos de parcela andam juntos, com `installment_number <= installment_total`.
- Aporte (`investment_id`) só em transação de saída.
- **Índice único `(recurring_id, date)`** — é o que torna a materialização de recorrentes idempotente sem lógica no app.

**Seed**: `seed_default_categories(uuid)` (idempotente) disparada por trigger em `auth.users` — Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Investimentos, Assinaturas, Outros (despesa); Salário, Freela, Rendimentos, Outros (receita) — cada uma com cor e ícone.

**Regras de cálculo importantes:**
- `invoice_month`: compra dia ≤ fechamento → fatura do mês seguinte ao fechamento vigente; compra após fechamento → fatura do mês subsequente. Função pura em `lib/invoices.ts`, testada.
- `closing_day`/`due_day`/`day_of_month` limitados a 1–28 para não brigar com fevereiro (simplificação deliberada; documentada na UI).
- Limite disponível do cartão = `limit_cents − (faturas abertas, i.e. transações de crédito ainda não pagas)`.
- Saldo da conta = inicial + receitas − despesas (excluindo compras no crédito; incluindo pagamentos de fatura).

## 3. Estrutura do projeto

```
financas/
├── supabase/
│   └── migrations/            # SQL versionado (aplicado via MCP/dashboard)
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/             # layout com nav inferior (mobile) / sidebar (desktop)
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── transacoes/    # lista mensal + navegação de mês
│   │   │   ├── contas/        # contas + cartões (tabs)
│   │   │   ├── categorias/
│   │   │   ├── investimentos/ # inclui patrimônio total
│   │   │   └── projecao/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── actions/               # server actions: transactions.ts, accounts.ts, ...
│   ├── components/
│   │   ├── ui/                # shadcn
│   │   ├── transaction-fab.tsx  # botão "+" flutuante → sheet de lançamento rápido
│   │   ├── charts/            # wrappers Recharts (client components)
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/          # client, server, middleware
│   │   ├── money.ts           # centavos ↔ BRL, parsing de input "1.234,56"
│   │   ├── dates.ts           # navegação de mês, timezone SP
│   │   ├── invoices.ts        # cálculo de invoice_month e faturas
│   │   ├── recurring.ts       # materialização idempotente
│   │   ├── installments.ts    # geração de parcelas
│   │   └── projection.ts      # algoritmo de projeção
│   ├── types/                 # tipos gerados do Supabase + domínio
│   └── proxy.ts               # proteção de rotas (auth) — no Next 16 `middleware` virou `proxy`
├── vitest.config.ts
└── ...
```

**UX do lançamento rápido (requisito 2–3 cliques):** FAB "+" sempre visível → abre `Sheet` (bottom sheet no mobile) → valor (teclado numérico), descrição, tipo pré-selecionado em "saída", categoria em grid de ícones, data default hoje, última forma de pagamento usada como default → salvar. 

## 4. Algoritmo de projeção (verde/vermelho)

Para cada mês futuro M (próximos 6):

```
projetado(M) = saldo_total_atual (só contas)
             + Σ recorrentes de receita ativas em M
             − Σ recorrentes de despesa ativas em M
             − Σ parcelas de crédito com fatura vencendo em M
             − média de gastos variáveis dos últimos 3 meses
               (variável = despesa não-recorrente e não-parcela)
```

- Projeção é acumulada: M+2 parte do projetado de M+1.
- Card **verde** se ≥ 0, **vermelho** se < 0.
- Cada card lista os 3 maiores "puxadores" (ex.: "Fatura Nubank vence dia 10 — R$ 2.340,00").
- Tudo em `lib/projection.ts` como função pura (recebe dados, retorna projeção) → testável.

## 5. Ordem de implementação (um commit por bloco concluído)

Cada fase termina com: `pnpm build` passando + checklist manual validado antes de seguir.

**Fase 0 — Fundação** ✅
1. Scaffold Next.js 15 + TS + Tailwind + shadcn/ui + Vitest; `lib/money.ts` e `lib/dates.ts` com testes.
2. Supabase: projeto, clients (browser/server), middleware de auth, página de login (email/senha), layout base com navegação.

**Fase 1 — Schema** ✅ *(SQL aprovado e aplicado)*
3. Migration completa + RLS + seed de categorias padrão. Tipos TS gerados.

**Fase 2 — CRUD de transações**
4. Lista mensal com navegação anterior/próximo + resumo do mês (entrou/saiu/saldo).
5. FAB + sheet de lançamento rápido; editar/excluir.

**Fase 3 — Recorrentes e parcelamento**
6. CRUD de regras recorrentes + materialização idempotente ao carregar o app.
7. Parcelamento no formulário (Nx) + geração das parcelas + edição "esta/todas restantes".

**Fase 4 — Contas e cartões**
8. CRUD contas com saldo computado; CRUD cartões.
9. Fatura por mês, limite disponível, alerta visual (>80% do limite: amarelo; estourado: vermelho); ação "pagar fatura".

**Fase 5 — Categorias**
10. CRUD de categorias customizadas (ícone + cor) e subcategorias.
11. Relatório de gastos por categoria do mês (pizza + barras, Recharts).

**Fase 6 — Investimentos**
12. CRUD investimentos; aporte via transação vinculada; atualização manual de valor atual; tela de patrimônio total (contas + investimentos).

**Fase 7 — Dashboard**
13. Saldo total, últimas transações, gastos por categoria do mês, gráfico entradas × saídas dos últimos 6 meses.

**Fase 8 — Projeção**
14. `lib/projection.ts` com testes; página de projeção + cards verde/vermelho no dashboard.

**Fase 9 — Polimento e deploy**
15. Passada mobile-first, estados vazios, loading/erro; deploy no Vercel (env vars) + smoke test em produção.

## 6. Riscos e simplificações deliberadas

- **Dias 29–31**: bloqueados nos campos de dia (fechamento, vencimento, recorrência) — evita toda a classe de bugs de fevereiro. Se incomodar, tratar depois com clamp.
- **Fatura**: modelo computado (sem tabela `invoices`). Se um dia precisar de "fatura fechada" imutável, adiciona-se a tabela — o `invoice_month` já deixa o caminho pronto.
- **Recorrentes**: só frequência mensal na v1 (cobre salário, aluguel, assinaturas). Semanal/anual ficam de fora.
- **Investimentos**: sem cotação automática — valor atual é manual, por design.
- **Cheque especial**: fora do escopo — conta pode ficar negativa e isso é só um saldo vermelho, sem limite modelado.
- **Carteira compartilhada**: fora do escopo — usuários são silos independentes. Se um dia precisar de despesas conjuntas, entra um `household_id` em todas as tabelas + tabela de membros, e o RLS passa a olhar participação em vez de `user_id`.
- **Multi-moeda, importação OFX/CSV**: fora do escopo v1.
