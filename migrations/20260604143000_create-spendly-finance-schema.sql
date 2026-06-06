CREATE TYPE public.account_type AS ENUM ('cash', 'bank', 'credit-card', 'savings');
CREATE TYPE public.category_type AS ENUM ('income', 'expense');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE public.recurring_frequency AS ENUM ('weekly', 'monthly', 'yearly');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.category_type NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transfer_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  notes TEXT,
  transaction_date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transactions_transfer_shape CHECK (
    (
      type = 'transfer'
      AND transfer_account_id IS NOT NULL
      AND transfer_account_id <> account_id
      AND category_id IS NULL
    )
    OR (
      type <> 'transfer'
      AND transfer_account_id IS NULL
      AND category_id IS NOT NULL
    )
  )
);

CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL CHECK (type <> 'transfer'),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  frequency public.recurring_frequency NOT NULL,
  next_due_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX accounts_user_id_name_key ON public.accounts (user_id, lower(name));
CREATE UNIQUE INDEX categories_user_id_name_type_key ON public.categories (user_id, lower(name), type);
CREATE UNIQUE INDEX budgets_user_id_category_id_month_year_key ON public.budgets (user_id, category_id, month, year);

CREATE INDEX profiles_user_id_idx ON public.profiles (user_id);
CREATE INDEX accounts_user_id_idx ON public.accounts (user_id);
CREATE INDEX categories_user_id_idx ON public.categories (user_id);
CREATE INDEX transactions_user_id_idx ON public.transactions (user_id);
CREATE INDEX transactions_account_id_idx ON public.transactions (account_id);
CREATE INDEX transactions_transaction_date_idx ON public.transactions (transaction_date DESC);
CREATE INDEX budgets_user_id_idx ON public.budgets (user_id);
CREATE INDEX savings_goals_user_id_idx ON public.savings_goals (user_id);
CREATE INDEX recurring_transactions_user_id_idx ON public.recurring_transactions (user_id);
CREATE INDEX recurring_transactions_next_due_date_idx ON public.recurring_transactions (next_due_date);

CREATE OR REPLACE FUNCTION public.adjust_account_balance(p_account_id UUID, p_delta NUMERIC)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE public.accounts
  SET balance = balance + p_delta
  WHERE id = p_account_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_transaction_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.type = 'income' THEN
      PERFORM public.adjust_account_balance(OLD.account_id, -OLD.amount);
    ELSIF OLD.type = 'expense' THEN
      PERFORM public.adjust_account_balance(OLD.account_id, OLD.amount);
    ELSE
      PERFORM public.adjust_account_balance(OLD.account_id, OLD.amount);
      PERFORM public.adjust_account_balance(OLD.transfer_account_id, -OLD.amount);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.type = 'income' THEN
      PERFORM public.adjust_account_balance(NEW.account_id, NEW.amount);
    ELSIF NEW.type = 'expense' THEN
      PERFORM public.adjust_account_balance(NEW.account_id, -NEW.amount);
    ELSE
      PERFORM public.adjust_account_balance(NEW.account_id, -NEW.amount);
      PERFORM public.adjust_account_balance(NEW.transfer_account_id, NEW.amount);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_spendly_user(p_full_name TEXT DEFAULT NULL, p_currency TEXT DEFAULT 'USD')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, currency)
  VALUES (current_user_id, NULLIF(p_full_name, ''), COALESCE(NULLIF(p_currency, ''), 'USD'))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.accounts (user_id, name, type, balance, currency)
  SELECT current_user_id, account_seed.name, account_seed.type::public.account_type, 0, COALESCE(NULLIF(p_currency, ''), 'USD')
  FROM (
    VALUES
      ('Cash', 'cash'),
      ('Bank', 'bank'),
      ('Credit Card', 'credit-card'),
      ('Savings', 'savings')
  ) AS account_seed(name, type)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.accounts existing_accounts
    WHERE existing_accounts.user_id = current_user_id
  );

  INSERT INTO public.categories (user_id, name, type, color, icon, is_default)
  SELECT current_user_id, category_seed.name, category_seed.type::public.category_type, category_seed.color, category_seed.icon, TRUE
  FROM (
    VALUES
      ('Food', 'expense', '#F97316', 'utensils-crossed'),
      ('Rent', 'expense', '#14B8A6', 'house'),
      ('Transport', 'expense', '#0EA5E9', 'car-taxi-front'),
      ('Shopping', 'expense', '#A855F7', 'shopping-bag'),
      ('Health', 'expense', '#F43F5E', 'heart-pulse'),
      ('Subscriptions', 'expense', '#EAB308', 'receipt'),
      ('Salary', 'income', '#22C55E', 'briefcase-business'),
      ('Investment', 'income', '#06B6D4', 'wallet-cards'),
      ('Travel', 'expense', '#8B5CF6', 'plane'),
      ('Other', 'expense', '#64748B', 'piggy-bank')
  ) AS category_seed(name, type, color, icon)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.categories existing_categories
    WHERE existing_categories.user_id = current_user_id
  );
END;
$$;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER savings_goals_updated_at
BEFORE UPDATE ON public.savings_goals
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER recurring_transactions_updated_at
BEFORE UPDATE ON public.recurring_transactions
FOR EACH ROW
EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER sync_transaction_balances
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_transaction_balances();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_owner_all ON public.profiles
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY accounts_owner_all ON public.accounts
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY categories_owner_all ON public.categories
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY transactions_owner_all ON public.transactions
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY budgets_owner_all ON public.budgets
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY savings_goals_owner_all ON public.savings_goals
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY recurring_transactions_owner_all ON public.recurring_transactions
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
