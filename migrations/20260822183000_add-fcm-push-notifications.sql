CREATE TABLE public.fcm_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  package_name TEXT NOT NULL DEFAULT 'com.spendly.finance.app'
    CHECK (package_name = 'com.spendly.finance.app'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fcm_device_token_shape CHECK (length(trim(device_token)) BETWEEN 32 AND 4096)
);

CREATE INDEX fcm_device_tokens_user_enabled_idx
ON public.fcm_device_tokens (user_id, enabled);

CREATE TABLE public.recurring_reminder_fcm_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES public.recurring_reminders(id) ON DELETE CASCADE,
  device_token_id UUID NOT NULL REFERENCES public.fcm_device_tokens(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reminder_id, device_token_id)
);

CREATE INDEX recurring_reminder_fcm_pending_idx
ON public.recurring_reminder_fcm_deliveries (sent_at, updated_at)
WHERE sent_at IS NULL;

ALTER TABLE public.fcm_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_reminder_fcm_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fcm_device_tokens FROM anon, authenticated;
REVOKE ALL ON public.recurring_reminder_fcm_deliveries FROM anon, authenticated;

CREATE TRIGGER fcm_device_tokens_updated_at
BEFORE UPDATE ON public.fcm_device_tokens
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER recurring_reminder_fcm_deliveries_updated_at
BEFORE UPDATE ON public.recurring_reminder_fcm_deliveries
FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE OR REPLACE FUNCTION public.register_fcm_device_token(
  p_device_token TEXT,
  p_package_name TEXT DEFAULT 'com.spendly.finance.app'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  normalized_token TEXT := trim(p_device_token);
  normalized_package TEXT := trim(p_package_name);
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF length(normalized_token) NOT BETWEEN 32 AND 4096 THEN
    RAISE EXCEPTION 'Invalid FCM device token';
  END IF;
  IF normalized_package <> 'com.spendly.finance.app' THEN
    RAISE EXCEPTION 'Invalid Android package';
  END IF;

  INSERT INTO public.fcm_device_tokens (
    user_id, device_token, package_name, enabled, last_registered_at
  )
  VALUES (
    current_user_id, normalized_token, normalized_package, TRUE, NOW()
  )
  ON CONFLICT (device_token) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    package_name = EXCLUDED.package_name,
    enabled = TRUE,
    last_registered_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_fcm_device_token(p_device_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  UPDATE public.fcm_device_tokens
  SET enabled = FALSE
  WHERE user_id = current_user_id
    AND device_token = trim(p_device_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_pending_recurring_reminder_fcm_pushes(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  reminder_id UUID,
  device_token_id UUID,
  device_token TEXT,
  package_name TEXT,
  title TEXT,
  body TEXT,
  due_date DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT
    reminder.id,
    token.id,
    token.device_token,
    token.package_name,
    reminder.title,
    reminder.body,
    reminder.due_date
  FROM public.recurring_reminders AS reminder
  JOIN public.profiles AS profile
    ON profile.user_id = reminder.user_id
  JOIN public.fcm_device_tokens AS token
    ON token.user_id = reminder.user_id
   AND token.enabled
  LEFT JOIN public.recurring_reminder_fcm_deliveries AS delivery
    ON delivery.reminder_id = reminder.id
   AND delivery.device_token_id = token.id
  WHERE profile.reminder_in_app_enabled
    AND reminder.dismissed_at IS NULL
    AND reminder.read_at IS NULL
    AND reminder.remind_on <= CURRENT_DATE
    AND delivery.sent_at IS NULL
  ORDER BY reminder.due_date ASC, reminder.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
$$;

CREATE OR REPLACE FUNCTION public.record_recurring_reminder_fcm_result(
  p_reminder_id UUID,
  p_device_token_id UUID,
  p_sent BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.recurring_reminder_fcm_deliveries (
    reminder_id, device_token_id, sent_at, last_error, attempt_count
  )
  VALUES (
    p_reminder_id,
    p_device_token_id,
    CASE WHEN p_sent THEN NOW() ELSE NULL END,
    CASE WHEN p_sent THEN NULL ELSE left(COALESCE(p_error, 'Unknown FCM error'), 1000) END,
    1
  )
  ON CONFLICT (reminder_id, device_token_id) DO UPDATE
  SET
    sent_at = CASE WHEN p_sent THEN NOW() ELSE public.recurring_reminder_fcm_deliveries.sent_at END,
    last_error = CASE WHEN p_sent THEN NULL ELSE left(COALESCE(p_error, 'Unknown FCM error'), 1000) END,
    attempt_count = public.recurring_reminder_fcm_deliveries.attempt_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.register_fcm_device_token(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_fcm_device_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_fcm_device_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_fcm_device_token(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.list_pending_recurring_reminder_fcm_pushes(INTEGER)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_recurring_reminder_fcm_result(UUID, UUID, BOOLEAN, TEXT)
FROM PUBLIC, anon, authenticated;
