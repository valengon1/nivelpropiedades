-- El sync-kiteprop marca las propiedades que desaparecen de KiteProp como
-- publish_status = 'Archivada', pero el check constraint original de la
-- columna nunca incluyó ese valor — todo intento de archivar fallaba
-- silenciosamente (el código no chequeaba el error de esa escritura
-- puntual, ya corregido aparte en supabase/functions/sync-kiteprop).
--
-- Lista completa de valores usados por la app: Publicada, Pausada,
-- Borrador, Vendida, Alquilada, Reservada, Archivada.

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_publish_status_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_publish_status_check
  CHECK (publish_status IN (
    'Publicada', 'Pausada', 'Borrador', 'Vendida', 'Alquilada', 'Reservada', 'Archivada'
  ));
