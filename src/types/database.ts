/**
 * Tipos do banco — espelham `supabase/migrations/0001_init.sql`.
 * Ao mexer numa migration, atualizar aqui na mesma leva.
 */

export type TxType = "income" | "expense";

export type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "debito"
  | "credito"
  | "boleto"
  | "transferencia";

export type InvestmentType = "renda_fixa" | "renda_variavel" | "reserva";

/** Data `YYYY-MM-DD` (coluna `date` do Postgres — sem hora, sem timezone). */
type DateStr = string;
/** `timestamptz` serializado como ISO 8601. */
type Timestamp = string;

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  type: TxType;
  parent_id: string | null;
  is_default: boolean;
  created_at: Timestamp;
};

type AccountRow = {
  id: string;
  user_id: string;
  name: string;
  initial_balance_cents: number;
  archived: boolean;
  created_at: Timestamp;
};

type CreditCardRow = {
  id: string;
  user_id: string;
  name: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  archived: boolean;
  created_at: Timestamp;
};

type RecurringTransactionRow = {
  id: string;
  user_id: string;
  description: string;
  amount_cents: number;
  type: TxType;
  category_id: string | null;
  payment_method: PaymentMethod;
  account_id: string | null;
  credit_card_id: string | null;
  day_of_month: number;
  start_date: DateStr;
  end_date: DateStr | null;
  active: boolean;
  created_at: Timestamp;
};

type InvestmentRow = {
  id: string;
  user_id: string;
  name: string;
  type: InvestmentType;
  current_value_cents: number;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type BudgetLineRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  description: string | null;
  amount_cents: number;
  created_at: Timestamp;
};

type TransactionRow = {
  id: string;
  user_id: string;
  description: string;
  amount_cents: number;
  type: TxType;
  date: DateStr;
  category_id: string | null;
  payment_method: PaymentMethod;
  account_id: string | null;
  credit_card_id: string | null;
  invoice_month: DateStr | null;
  recurring_id: string | null;
  installment_group_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  investment_id: string | null;
  is_invoice_payment: boolean;
  created_at: Timestamp;
};

/** Colunas com default no banco viram opcionais no insert. */
type Defaulted = "id" | "created_at" | "updated_at";

type TableFor<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Extract<Defaulted | Optional, keyof Row>> &
    Partial<Pick<Row, Extract<Defaulted | Optional, keyof Row>>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      categories: TableFor<
        CategoryRow,
        "icon" | "color" | "parent_id" | "is_default"
      >;
      accounts: TableFor<AccountRow, "initial_balance_cents" | "archived">;
      credit_cards: TableFor<CreditCardRow, "archived">;
      recurring_transactions: TableFor<
        RecurringTransactionRow,
        | "category_id"
        | "account_id"
        | "credit_card_id"
        | "end_date"
        | "active"
      >;
      investments: TableFor<InvestmentRow, "current_value_cents">;
      budget_lines: TableFor<BudgetLineRow, "category_id" | "description">;
      transactions: TableFor<
        TransactionRow,
        | "category_id"
        | "account_id"
        | "credit_card_id"
        | "invoice_month"
        | "recurring_id"
        | "installment_group_id"
        | "installment_number"
        | "installment_total"
        | "investment_id"
        | "is_invoice_payment"
      >;
    };
    Views: Record<never, never>;
    Functions: {
      seed_default_categories: {
        Args: { target_user: string };
        Returns: undefined;
      };
    };
    Enums: {
      tx_type: TxType;
      payment_method: PaymentMethod;
      investment_type: InvestmentType;
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicTables = Database["public"]["Tables"];

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> =
  PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> =
  PublicTables[T]["Update"];

export type Category = Tables<"categories">;
export type Account = Tables<"accounts">;
export type CreditCard = Tables<"credit_cards">;
export type RecurringTransaction = Tables<"recurring_transactions">;
export type Investment = Tables<"investments">;
export type Transaction = Tables<"transactions">;
export type BudgetLine = Tables<"budget_lines">;
