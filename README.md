# Finanças

Controle financeiro pessoal — mobile-first, valores em R$. Next.js 16 (App
Router) + TypeScript, Tailwind v4 + shadcn/ui, Supabase (Postgres + Auth),
Recharts, deploy na Vercel.

Visão geral e decisões de arquitetura em [`PLANNING.md`](PLANNING.md).

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase
npm run dev                  # http://localhost:3000
```

Variáveis de ambiente (`.env.local`):

| Variável | Onde achar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → publishable key (ou a legada anon key) |

> Só a publishable/anon key é usada — nunca a `service_role`. Toda a segurança
> vem do RLS (`user_id = auth.uid()`) em cada tabela.

## Banco de dados

As migrations vivem em [`supabase/migrations/`](supabase/migrations) e são a
fonte da verdade do schema. Aplique **em ordem** no Supabase (SQL Editor →
colar → Run):

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `0001_init.sql` | Tabelas, RLS, seed de categorias padrão (trigger em `auth.users`) |
| 2 | `0002_budget.sql` | Linhas de orçamento da projeção |
| 3 | `0003_affects_balance.sql` | Pagamento de fatura que não mexe no saldo (histórico) |
| 4 | `0004_budget_type.sql` | Entrada/saída nas linhas de orçamento |

As de `0002` em diante são `ALTER`/`create` não-destrutivos — preservam os dados.

### Usuários

Não há tela de cadastro (single/poucos usuários). Crie cada pessoa em
**Authentication → Users → Add user** (marque *auto confirm*). O trigger semeia
as categorias padrão. Desligue o cadastro público em **Authentication → Sign In
/ Providers → Email → "Allow new users to sign up"**.

## Testes e checagens

```bash
npm test        # Vitest — só as funções críticas (dinheiro, fatura, projeção…)
npm run lint    # ESLint
npm run build   # build de produção
```

## Deploy na Vercel

1. Repositório no GitHub (privado).
2. Vercel → **New Project** → importe o repositório. O framework (Next.js) é
   detectado sozinho.
3. Em **Environment Variables**, adicione as duas variáveis acima (mesmos
   valores do `.env.local`).
4. **Deploy.**
5. Supabase → **Authentication → URL Configuration**: adicione a URL de
   produção da Vercel em *Site URL* e *Redirect URLs*.
6. Smoke test em produção: login, lançar uma transação, abrir a projeção.
