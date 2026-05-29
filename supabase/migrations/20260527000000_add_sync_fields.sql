-- Agrega campos de sincronización con KiteProp a la tabla properties
-- Ejecutar una sola vez en Supabase Dashboard > SQL Editor

-- Columna para el ID interno de KiteProp (ej: "517676")
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS kiteprop_id TEXT;

-- URL de la propiedad en KiteProp
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Última vez que se sincronizó con KiteProp
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS source_synced_at TIMESTAMPTZ;

-- Índice para buscar por kiteprop_id rápidamente (deduplicación)
CREATE UNIQUE INDEX IF NOT EXISTS properties_kiteprop_id_idx
  ON properties (kiteprop_id)
  WHERE kiteprop_id IS NOT NULL;

-- Índice para buscar por source_url
CREATE INDEX IF NOT EXISTS properties_source_url_idx
  ON properties (source_url)
  WHERE source_url IS NOT NULL;

-- Confirmar
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'properties'
  AND column_name IN ('kiteprop_id', 'source_url', 'source_synced_at')
ORDER BY column_name;
