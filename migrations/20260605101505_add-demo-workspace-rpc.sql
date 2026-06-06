CREATE OR REPLACE FUNCTION public.seed_spendly_demo_workspace()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  profile_currency TEXT;
  month_start DATE := date_trunc('month', current_date)::date;
  today_offset INTEGER := GREATEST(EXTRACT(DAY FROM current_date)::int - 1, 0);
  current_month INTEGER := EXTRACT(MONTH FROM current_date)::int;
  current_year INTEGER := EXTRACT(YEAR FROM current_date)::int;
  cash_account_id UUID;
  bank_account_id UUID;
  credit_card_account_id UUID;
  savings_account_id UUID;
  food_category_id UUID;
  rent_category_id UUID;
  transport_category_id UUID;
  shopping_category_id UUID;
  health_category_id UUID;
  subscriptions_category_id UUID;
  salary_category_id UUID;
  investment_category_id UUID;
  travel_category_id UUID;
  other_category_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT currency
  INTO profile_currency
  FROM public.profiles
  WHERE user_id = current_user_id
  LIMIT 1;

  PERFORM public.bootstrap_spendly_user(NULL, COALESCE(profile_currency, 'USD'));

  IF EXISTS (SELECT 1 FROM public.transactions WHERE user_id = current_user_id)
    OR EXISTS (SELECT 1 FROM public.budgets WHERE user_id = current_user_id)
    OR EXISTS (SELECT 1 FROM public.savings_goals WHERE user_id = current_user_id)
    OR EXISTS (SELECT 1 FROM public.recurring_transactions WHERE user_id = current_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.accounts
      WHERE user_id = current_user_id
        AND balance <> 0
    )
  THEN
    RAISE EXCEPTION 'Demo workspace can only be loaded into an empty workspace.';
  END IF;

  SELECT id INTO cash_account_id
  FROM public.accounts
  WHERE user_id = current_user_id AND lower(name) = 'cash'
  LIMIT 1;

  SELECT id INTO bank_account_id
  FROM public.accounts
  WHERE user_id = current_user_id AND lower(name) = 'bank'
  LIMIT 1;

  SELECT id INTO credit_card_account_id
  FROM public.accounts
  WHERE user_id = current_user_id AND lower(name) = 'credit card'
  LIMIT 1;

  SELECT id INTO savings_account_id
  FROM public.accounts
  WHERE user_id = current_user_id AND lower(name) = 'savings'
  LIMIT 1;

  SELECT id INTO food_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'food' AND type = 'expense'
  LIMIT 1;

  SELECT id INTO rent_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'rent' AND type = 'expense'
  LIMIT 1;

  SELECT id INTO transport_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'transport' AND type = 'expense'
  LIMIT 1;

  SELECT id INTO shopping_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'shopping' AND type = 'expense'
  LIMIT 1;

  SELECT id INTO health_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'health' AND type = 'expense'
  LIMIT 1;

  SELECT id INTO subscriptions_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'subscriptions' AND type = 'expense'
  LIMIT 1;

  SELECT id INTO salary_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'salary' AND type = 'income'
  LIMIT 1;

  SELECT id INTO investment_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'investment' AND type = 'income'
  LIMIT 1;

  SELECT id INTO travel_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'travel' AND type = 'expense'
  LIMIT 1;

  SELECT id INTO other_category_id
  FROM public.categories
  WHERE user_id = current_user_id AND lower(name) = 'other' AND type = 'expense'
  LIMIT 1;

  IF cash_account_id IS NULL
    OR bank_account_id IS NULL
    OR credit_card_account_id IS NULL
    OR savings_account_id IS NULL
    OR food_category_id IS NULL
    OR rent_category_id IS NULL
    OR transport_category_id IS NULL
    OR shopping_category_id IS NULL
    OR health_category_id IS NULL
    OR subscriptions_category_id IS NULL
    OR salary_category_id IS NULL
    OR investment_category_id IS NULL
    OR travel_category_id IS NULL
    OR other_category_id IS NULL
  THEN
    RAISE EXCEPTION 'Default accounts or categories are missing from this workspace.';
  END IF;

  INSERT INTO public.budgets (user_id, category_id, amount, month, year)
  VALUES
    (current_user_id, rent_category_id, 95000, current_month, current_year),
    (current_user_id, food_category_id, 25000, current_month, current_year),
    (current_user_id, shopping_category_id, 30000, current_month, current_year),
    (current_user_id, transport_category_id, 12000, current_month, current_year),
    (current_user_id, health_category_id, 10000, current_month, current_year),
    (current_user_id, subscriptions_category_id, 4500, current_month, current_year),
    (current_user_id, other_category_id, 5000, current_month, current_year),
    (current_user_id, travel_category_id, 15000, current_month, current_year);

  INSERT INTO public.savings_goals (user_id, name, target_amount, current_amount, deadline)
  VALUES
    (current_user_id, 'Emergency Fund', 500000, 125000, current_date + 210),
    (current_user_id, 'Turkey Vacation', 180000, 45000, current_date + 120),
    (current_user_id, 'New Laptop', 250000, 90000, current_date + 90);

  INSERT INTO public.recurring_transactions (
    user_id,
    account_id,
    category_id,
    type,
    amount,
    description,
    frequency,
    next_due_date,
    active
  )
  VALUES
    (current_user_id, credit_card_account_id, subscriptions_category_id, 'expense', 1299, 'Spotify Family', 'monthly', current_date + 5, TRUE),
    (current_user_id, bank_account_id, health_category_id, 'expense', 3500, 'Gym Membership', 'monthly', current_date + 7, TRUE),
    (current_user_id, bank_account_id, subscriptions_category_id, 'expense', 4500, 'Internet Bill', 'monthly', current_date + 12, TRUE),
    (current_user_id, savings_account_id, investment_category_id, 'income', 15000, 'Mutual Fund SIP', 'monthly', current_date + 20, TRUE),
    (current_user_id, bank_account_id, salary_category_id, 'income', 320000, 'Salary', 'monthly', current_date + 27, TRUE);

  INSERT INTO public.transactions (
    user_id,
    account_id,
    transfer_account_id,
    category_id,
    type,
    amount,
    description,
    notes,
    transaction_date,
    is_recurring
  )
  VALUES
    (current_user_id, bank_account_id, NULL, salary_category_id, 'income', 320000, 'Monthly Salary', 'Primary salary deposit', month_start + LEAST(0, today_offset), TRUE),
    (current_user_id, savings_account_id, NULL, investment_category_id, 'income', 25000, 'Dividend Payout', 'Quarterly portfolio payout', month_start + LEAST(1, today_offset), FALSE),
    (current_user_id, bank_account_id, NULL, rent_category_id, 'expense', 95000, 'Apartment Rent', 'Current month rent', month_start + LEAST(0, today_offset), TRUE),
    (current_user_id, credit_card_account_id, NULL, food_category_id, 'expense', 8200, 'Groceries at Imtiaz', 'Weekly grocery refill', month_start + LEAST(2, today_offset), FALSE),
    (current_user_id, credit_card_account_id, NULL, food_category_id, 'expense', 12800, 'Dinner and pantry run', 'Family dinner and pantry top-up', month_start + LEAST(3, today_offset), FALSE),
    (current_user_id, cash_account_id, NULL, transport_category_id, 'expense', 8500, 'Fuel and ride-hailing', 'Fuel plus ride apps', month_start + LEAST(3, today_offset), FALSE),
    (current_user_id, credit_card_account_id, NULL, shopping_category_id, 'expense', 22000, 'Work desk accessories', 'Monitor arm and desk lamp', month_start + LEAST(1, today_offset), FALSE),
    (current_user_id, credit_card_account_id, NULL, shopping_category_id, 'expense', 11500, 'Running shoes', 'New training shoes', month_start + LEAST(2, today_offset), FALSE),
    (current_user_id, bank_account_id, NULL, health_category_id, 'expense', 6000, 'Clinic visit', 'Consultation and medicines', month_start + LEAST(3, today_offset), FALSE),
    (current_user_id, bank_account_id, NULL, subscriptions_category_id, 'expense', 3999, 'Netflix and cloud storage', 'Monthly digital services', month_start + LEAST(3, today_offset), TRUE),
    (current_user_id, bank_account_id, savings_account_id, NULL, 'transfer', 40000, 'Move money to savings', 'Monthly reserve transfer', month_start + LEAST(2, today_offset), FALSE),
    (current_user_id, bank_account_id, cash_account_id, NULL, 'transfer', 15000, 'ATM withdrawal', 'Cash top-up for the week', month_start + LEAST(1, today_offset), FALSE),
    (current_user_id, cash_account_id, NULL, other_category_id, 'expense', 2500, 'Coffee and misc', 'Coffee, parking, and misc spend', month_start + LEAST(3, today_offset), FALSE);

  PERFORM public.generate_recurring_reminders(current_user_id);

  RETURN jsonb_build_object(
    'transactions', 13,
    'budgets', 8,
    'goals', 3,
    'recurringTransactions', 5
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_spendly_demo_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_spendly_demo_workspace() TO authenticated;
