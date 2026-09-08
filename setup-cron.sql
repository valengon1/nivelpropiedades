-- ============================================================
-- SETUP: Cron automático cada 5 minutos via pg_cron + pg_net
-- Ejecutar en Supabase Dashboard > SQL Editor
--
-- Por qué 5 minutos y no menos: el sync recorre TODAS las
-- propiedades de KiteProp en cada corrida y tarda 45-70 segundos.
-- Un intervalo menor a esa duración hace que una corrida empiece
-- antes de que termine la anterior (se pisan entre sí, además de
-- sobrecargar el sitio de KiteProp con pedidos constantes). 5
-- minutos deja margen de sobra y sigue siendo casi instantáneo
-- para una web inmobiliaria.
-- ============================================================

-- 1. Habilitar extensiones necesarias (si no están habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. (Opcional) Verificar que estén activas
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- ============================================================
-- 3. Eliminar cualquier job anterior (6h, 15m, etc.) y crear el nuevo
-- ============================================================

DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job WHERE jobname LIKE 'sync-kiteprop%' LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- IMPORTANTE: reemplazar SERVICE_ROLE_KEY con tu clave real
-- (Supabase Dashboard > Settings > API > service_role key)

SELECT cron.schedule(
  'sync-kiteprop-every-5m',         -- nombre del job (único)
  '*/5 * * * *',                    -- cada 5 minutos
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
WHERE jobname = 'sync-kiteprop-every-5m';

-- ============================================================
-- COMANDOS ÚTILES
-- ============================================================

-- Ver historial de ejecuciones:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-kiteprop-every-5m') ORDER BY start_time DESC LIMIT 20;

-- Pausar el cron:
-- SELECT cron.unschedule('sync-kiteprop-every-5m');

-- Re-activar:
-- SELECT cron.schedule('sync-kiteprop-every-5m', '*/5 * * * *', $$...$$);

-- Ejecutar el sync manualmente desde SQL (sin esperar el cron):
-- SELECT net.http_post(
--   url     := 'https://mclnbxiwmoilpjczuwpy.supabase.co/functions/v1/sync-kiteprop',
--   headers := jsonb_build_object('Authorization', 'Bearer TU_SERVICE_ROLE_KEY_AQUI', 'Content-Type', 'application/json'),
--   body    := '{}'::jsonb
-- );
