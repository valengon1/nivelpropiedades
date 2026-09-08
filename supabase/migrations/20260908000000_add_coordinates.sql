-- Agrega latitud/longitud a properties, tomadas directamente del mapa que
-- KiteProp ya tiene geocodificado para cada aviso (en vez de re-geocodificar
-- la dirección en texto en el frontend, que es ambiguo: p. ej. "Merlo" es a
-- la vez una calle en Castelar y una ciudad/partido distinta).

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
