-- ============================================================
-- Gate 3 Remediation: RPC Funciones Atómicas de Proyección Kick
-- Migration: upsert_kick_subscriber_rpc
-- ============================================================
-- Elimina la condición de carrera (Check-Then-Act) reemplazando la
-- consulta SELECT previa por una sentencia SQL atómica ON CONFLICT DO UPDATE
-- con guard monotónico WHERE last_event_timestamp < EXCLUDED.last_event_timestamp.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_kick_subscriber_projection(
  p_broadcaster_kick_user_id text,
  p_subscriber_kick_user_id text,
  p_subscription_type text,
  p_is_active boolean,
  p_expires_at timestamptz,
  p_last_event_timestamp timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows_affected integer;
  v_reason text := 'updated';
BEGIN
  INSERT INTO public.kick_subscribers (
    broadcaster_kick_user_id,
    subscriber_kick_user_id,
    subscription_type,
    is_active,
    expires_at,
    last_event_timestamp,
    created_at,
    updated_at
  )
  VALUES (
    p_broadcaster_kick_user_id,
    p_subscriber_kick_user_id,
    p_subscription_type,
    p_is_active,
    p_expires_at,
    p_last_event_timestamp,
    now(),
    now()
  )
  ON CONFLICT (broadcaster_kick_user_id, subscriber_kick_user_id)
  DO UPDATE SET
    -- Caso A: Directa Activa + Gifted nuevo -> Conserva 'direct' y su expires_at
    subscription_type = CASE
      WHEN EXCLUDED.subscription_type = 'gifted'
           AND kick_subscribers.subscription_type = 'direct'
           AND kick_subscribers.is_active = true
           AND kick_subscribers.expires_at > now()
      THEN 'direct'
      ELSE EXCLUDED.subscription_type
    END,
    is_active = EXCLUDED.is_active,
    expires_at = CASE
      WHEN EXCLUDED.subscription_type = 'gifted'
           AND kick_subscribers.subscription_type = 'direct'
           AND kick_subscribers.is_active = true
           AND kick_subscribers.expires_at > now()
      THEN kick_subscribers.expires_at
      ELSE EXCLUDED.expires_at
    END,
    last_event_timestamp = EXCLUDED.last_event_timestamp,
    updated_at = now()
  WHERE kick_subscribers.last_event_timestamp < EXCLUDED.last_event_timestamp;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    v_reason := 'stale_event';
  END IF;

  RETURN jsonb_build_object(
    'updated', v_rows_affected > 0,
    'reason', v_reason,
    'affected_rows', v_rows_affected
  );
END;
$$;

-- Permisos RPC para la función individual
REVOKE ALL ON FUNCTION public.upsert_kick_subscriber_projection(text, text, text, boolean, timestamptz, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_kick_subscriber_projection(text, text, text, boolean, timestamptz, timestamptz) TO service_role;

-- Función Batch para procesar arreglo de giftees en una sola llamada RPC atómica
CREATE OR REPLACE FUNCTION public.upsert_kick_subscriber_projection_batch(
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_updated_count integer := 0;
  v_stale_count integer := 0;
  v_res jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_res := public.upsert_kick_subscriber_projection(
      (v_item->>'broadcaster_kick_user_id')::text,
      (v_item->>'subscriber_kick_user_id')::text,
      (v_item->>'subscription_type')::text,
      (v_item->>'is_active')::boolean,
      (v_item->>'expires_at')::timestamptz,
      (v_item->>'last_event_timestamp')::timestamptz
    );
    IF (v_res->>'updated')::boolean THEN
      v_updated_count := v_updated_count + 1;
    ELSE
      v_stale_count := v_stale_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'updated', v_updated_count > 0,
    'reason', CASE WHEN v_updated_count = 0 AND v_stale_count > 0 THEN 'stale_event' ELSE 'updated' END,
    'affected_rows', v_updated_count
  );
END;
$$;

-- Permisos RPC para la función batch
REVOKE ALL ON FUNCTION public.upsert_kick_subscriber_projection_batch(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_kick_subscriber_projection_batch(jsonb) TO service_role;
