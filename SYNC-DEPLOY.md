# Deploy: sync-kiteprop Edge Function

Sistema de sincronización automática entre KiteProp CRM y Supabase.

---

## Estructura de archivos

```
supabase/
  config.toml
  functions/
    sync-kiteprop/
      index.ts            ← Edge Function principal
  migrations/
    20260527000000_add_sync_fields.sql  ← Columnas nuevas en DB
setup-cron.sql            ← Cron automático cada 6h
SYNC-DEPLOY.md            ← Este archivo
```

---

## Paso 1 — Migración de base de datos

En **Supabase Dashboard → SQL Editor**, pegar y ejecutar el contenido de:

```
supabase/migrations/20260527000000_add_sync_fields.sql
```

Esto agrega las columnas `kiteprop_id`, `source_url` y `source_synced_at` a la tabla `properties`.

---

## Paso 2 — Instalar Supabase CLI

```bash
brew install supabase/tap/supabase
# o
npm install -g supabase
```

Verificar versión:
```bash
supabase --version
```

---

## Paso 3 — Login y link al proyecto

```bash
supabase login
# Abre el browser para autenticar

supabase link --project-ref mclnbxiwmoilpjczuwpy
# Ingresá la database password cuando la pida
```

---

## Paso 4 — Deploy de la Edge Function

```bash
cd /ruta/a/nivelprop

supabase functions deploy sync-kiteprop \
  --project-ref mclnbxiwmoilpjczuwpy
```

Verificar en Supabase Dashboard → **Edge Functions** que aparezca `sync-kiteprop`.

---

## Paso 5 — Variables de entorno (Secrets)

La función ya tiene acceso a `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` por defecto en Supabase Edge Functions. No necesitás configurar nada extra.

Si querés agregar secretos adicionales:
```bash
supabase secrets set MI_SECRET=valor --project-ref mclnbxiwmoilpjczuwpy
```

---

## Paso 6 — Configurar cron automático

En **Supabase Dashboard → SQL Editor**, ejecutar `setup-cron.sql`.

**IMPORTANTE:** Antes de ejecutar, reemplazar `TU_SERVICE_ROLE_KEY_AQUI` con tu clave real:

- Ir a: **Supabase Dashboard → Settings → API → Project API Keys**
- Copiar el valor de `service_role` (la clave larga)
- Pegar en el script reemplazando el placeholder

El cron se ejecutará automáticamente cada 6 horas (00:00, 06:00, 12:00, 18:00 UTC).

---

## Uso manual

### Dry Run (simular sin guardar)

```bash
curl -X GET \
  "https://mclnbxiwmoilpjczuwpy.supabase.co/functions/v1/sync-kiteprop?dry=1" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY"
```

Respuesta:
```json
{
  "ok": true,
  "dry": true,
  "duration": "12.3s",
  "stats": {
    "created": 3,
    "updated": 1,
    "archived": 0,
    "unchanged": 4,
    "imageUpdates": 3,
    "errors": 0
  },
  "created": ["KP517676: Departamento de 1 amb. centro Ramos Mejía"],
  "updated": [],
  "archived": [],
  "unchanged": ["KP514291: DEPARTAMENTO 1 AMB. CON PATIO"],
  "imageUpdates": ["517676"],
  "errors": []
}
```

### Sync real

```bash
curl -X POST \
  "https://mclnbxiwmoilpjczuwpy.supabase.co/functions/v1/sync-kiteprop" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Logs en tiempo real

```bash
supabase functions logs sync-kiteprop \
  --project-ref mclnbxiwmoilpjczuwpy \
  --tail
```

Ejemplo de logs:
```
[SYNC] ▶ Leyendo propiedades de KiteProp...
[SYNC] ✔ 8 URLs encontradas en KiteProp
[SYNC] ▶ Leyendo propiedades de Supabase...
[SYNC] ✔ 3 propiedades en DB | 8 en KiteProp
[SYNC] ▶ Scrapeando detalles...
[SYNC] 📦 Batch 1/3 (3 props)
[SYNC] 📦 Batch 2/3 (3 props)
[SYNC] 📦 Batch 3/3 (2 props)
[SYNC] ✔ 8/8 propiedades scrapeadas
[SYNC] ✚ propiedad creada: "OPORTUNIDAD EN RAMOS MEJÍA: PH AL FRENTE" (KP513224)
[SYNC] 🖼 Imagen 1/6 subida → properties/kp-513224-000.jpg
[SYNC] 🖼 Imagen 2/6 subida → properties/kp-513224-001.jpg
[SYNC] — sin cambios: "Departamento de 1 amb. centro Ramos Mejía"
[SYNC] ✎ propiedad actualizada: "DEPARTAMENTO 2 MAB - RAMOS MEJIA" (KP514247)
[SYNC] ✅ Completado en 45.2s | +3 creadas, ~1 actualizadas, 📦 0 archivadas, ✗ 0 errores
```

---

## Cómo funciona

```
KiteProp CRM ──scrape──▶ Extrae URLs + detalles
                                │
                                ▼
              Compara con propiedades en Supabase
                    │           │           │
                  NUEVA      CAMBIÓ     DESAPARECIÓ
                    │           │           │
               Crear en DB   Actualizar   publishStatus
              + subir imgs   + imgs si    = "Archivada"
                             cambiaron
```

### Deduplicación

Busca coincidencias en este orden:
1. `kiteprop_id` (ID numérico de KiteProp)
2. `source_url` (URL exacta)
3. Título normalizado
4. Dirección + tipo de operación

### Imágenes

- Solo usa imágenes `/lg/` (alta resolución) de KiteProp CDN
- Valida header de archivo (JPEG/PNG/WebP) y tamaño mínimo 5KB
- Evita placeholders blancos o en miniatura
- La portada (`image`) = primera imagen del array, nunca duplicada
- Al actualizar, borra las imágenes viejas antes de subir las nuevas

### Propiedades eliminadas

Si una propiedad desaparece de KiteProp, **no se borra**. Se marca como:
```
publish_status = "Archivada"
```
Así no aparece en el sitio público pero se conserva el historial.

### Status preservados

Si una propiedad tiene status manual (`Vendida`, `Alquilada`, `Reservada`, `Borrador`, `Pausada`), el sync no lo sobreescribe.

---

## Verificar historial de ejecuciones del cron

En **SQL Editor**:

```sql
SELECT
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'sync-kiteprop-every-6h'
)
ORDER BY start_time DESC
LIMIT 20;
```

---

## Troubleshooting

### "Unauthorized" al llamar la función
→ Verificar que el Bearer token sea el `service_role key` (no el `anon key`)

### Timeout de la función
→ Reducir `BATCH_SIZE` en `index.ts` de 3 a 2 y re-deployar

### Imágenes no se suben
→ Verificar que el bucket `property-images` exista en Supabase Storage
→ Verificar que el bucket sea público (o configurar políticas RLS apropiadas)

### Cron no se ejecuta
→ Verificar en `cron.job` que `active = true`
→ Verificar que `pg_net` esté habilitado en Extensions
→ Revisar logs en `cron.job_run_details`
