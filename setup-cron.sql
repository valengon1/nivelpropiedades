-- ============================================================
-- SETUP: Cron automático cada 15 minutos via pg_cron + pg_net
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Habilitar extensiones necesarias (si no están habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. (Opcional) Verificar que estén activas
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- ============================================================
-- 3. Eliminar el job anterior (si existía) y crear el nuevo
-- ============================================================

SELECT cron.unschedule('sync-kiteprop-every-6h');

-- IMPORTANTE: reemplazar SERVICE_ROLE_KEY con tu clave real
-- (Supabase Dashboard > Settings > API > service_role key)

SELECT cron.schedule(
  'sync-kiteprop-every-15m',        -- nombre del job (único)
  '*/15 * * * *',                   -- cada 15 minutos
  $$
  SELECT net.http_post(
    url     := 'https://mclnbxiwmoilpjczuwpy.supabase.co/functions/v1/sync-kiteprop',
    headers := jsonb_build_object(
      'Authorization',  'Bearer TU_SERVICE_ROLE_KEY_AQUI',
      'Content-Type',   'application/json'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- 4. Verificar que el job fue creado
-- ============================================================

SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'sync-kiteprop-every-15m';

-- ============================================================
-- COMANDOS ÚTILES
-- ============================================================

-- Ver historial de ejecuciones:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-kiteprop-every-15m') ORDER BY start_time DESC LIMIT 20;

-- Pausar el cron:
-- SELECT cron.unschedule('sync-kiteprop-every-15m');

-- Re-activar:
-- SELECT cron.schedule('sync-kiteprop-every-15m', '*/15 * * * *', $$...$$);

-- Ejecutar el sync manualmente desde SQL (sin esperar el cron):
-- SELECT net.http_post(
--   url     := 'https://mclnbxiwmoilpjczuwpy.supabase.co/functions/v1/sync-kiteprop',
--   headers := jsonb_build_object('Authorization', 'Bearer TU_SERVICE_ROLE_KEY_AQUI', 'Content-Type', 'application/json'),
--   body    := '{}'::jsonb
-- );
