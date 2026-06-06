CREATE OR REPLACE FUNCTION public.generate_recurring_reminders(p_target_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_subject TEXT := COALESCE(current_setting('request.jwt.claim.sub', TRUE), '');
  caller_role TEXT := COALESCE(current_setting('request.jwt.claim.role', TRUE), '');
  caller_id UUID := NULL;
  effective_user_id UUID := p_target_user_id;
  inserted_count INTEGER := 0;
BEGIN
  IF caller_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    caller_id := caller_subject::UUID;
  END IF;

  IF caller_id IS NULL
    AND caller_subject NOT IN ('service_role', 'project-admin-with-api-key')
    AND caller_role NOT IN ('service_role', 'project-admin-with-api-key')
  THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF caller_id IS NOT NULL THEN
    effective_user_id := caller_id;
  END IF;

  INSERT INTO public.recurring_reminders (
    user_id,
    recurring_transaction_id,
    kind,
    title,
    body,
    due_date,
    remind_on
  )
  SELECT
    candidate.user_id,
    candidate.recurring_transaction_id,
    candidate.kind,
    candidate.title,
    candidate.body,
    candidate.due_date,
    candidate.remind_on
  FROM (
    SELECT
      recurring.user_id,
      recurring.id AS recurring_transaction_id,
      CASE
        WHEN recurring.next_due_date < CURRENT_DATE THEN 'overdue'::public.recurring_reminder_kind
        ELSE 'upcoming'::public.recurring_reminder_kind
      END AS kind,
      CASE
        WHEN recurring.next_due_date < CURRENT_DATE THEN recurring.description || ' is overdue'
        ELSE recurring.description || ' is due soon'
      END AS title,
      CASE
        WHEN recurring.next_due_date < CURRENT_DATE THEN
          format(
            '%s was due on %s. Update the due date or record the payment to clear this alert.',
            recurring.description,
            to_char(recurring.next_due_date, 'Mon DD')
          )
        ELSE
          format(
            '%s is due on %s. Review the account and record it when it lands.',
            recurring.description,
            to_char(recurring.next_due_date, 'Mon DD')
          )
      END AS body,
      recurring.next_due_date AS due_date,
      CASE
        WHEN recurring.next_due_date < CURRENT_DATE THEN recurring.next_due_date
        ELSE recurring.next_due_date - COALESCE(profile.reminder_days_before, 3)
      END AS remind_on
    FROM public.recurring_transactions AS recurring
    JOIN public.profiles AS profile
      ON profile.user_id = recurring.user_id
    WHERE recurring.active
      AND COALESCE(profile.reminder_in_app_enabled, TRUE)
      AND (effective_user_id IS NULL OR recurring.user_id = effective_user_id)
      AND (
        recurring.next_due_date < CURRENT_DATE
        OR recurring.next_due_date - COALESCE(profile.reminder_days_before, 3) <= CURRENT_DATE
      )
  ) AS candidate
  ON CONFLICT (user_id, recurring_transaction_id, due_date, kind) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_recurring_reminder_emails(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  reminder_id UUID,
  user_id UUID,
  email TEXT,
  full_name TEXT,
  title TEXT,
  body TEXT,
  due_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_subject TEXT := COALESCE(current_setting('request.jwt.claim.sub', TRUE), '');
  caller_role TEXT := COALESCE(current_setting('request.jwt.claim.role', TRUE), '');
BEGIN
  IF caller_subject NOT IN ('service_role', 'project-admin-with-api-key')
    AND caller_role NOT IN ('service_role', 'project-admin-with-api-key')
  THEN
    RAISE EXCEPTION 'Only admin contexts can list reminder email jobs.';
  END IF;

  RETURN QUERY
  SELECT
    reminder.id,
    reminder.user_id,
    auth_user.email,
    profile.full_name,
    reminder.title,
    reminder.body,
    reminder.due_date
  FROM public.recurring_reminders AS reminder
  JOIN public.profiles AS profile
    ON profile.user_id = reminder.user_id
  JOIN auth.users AS auth_user
    ON auth_user.id = reminder.user_id
  WHERE profile.reminder_email_enabled
    AND reminder.dismissed_at IS NULL
    AND reminder.read_at IS NULL
    AND reminder.email_sent_at IS NULL
    AND auth_user.email IS NOT NULL
  ORDER BY reminder.due_date ASC, reminder.created_at ASC
  LIMIT GREATEST(COALESCE(p_limit, 25), 1);
END;
$$;
