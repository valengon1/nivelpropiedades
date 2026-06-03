-- ============================================================
-- SOLICITUDES DE DATOS PERSONALES — NIVEL PROPIEDADES
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Tabla principal ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token              UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  direccion          TEXT NOT NULL,
  nombre_ref         TEXT,
  cantidad_personas  INT NOT NULL CHECK (cantidad_personas BETWEEN 1 AND 5),
  estado             TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'completada', 'vencida')),
  fecha_vencimiento  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  fecha_completada   TIMESTAMPTZ,
  pdf_url            TEXT,
  zip_url            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Fichas por persona ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fichas_personas (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id         BIGINT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  numero_persona       INT NOT NULL CHECK (numero_persona BETWEEN 1 AND 5),
  paso_completado      INT NOT NULL DEFAULT 0,

  -- Datos personales
  nombre               TEXT,
  apellido             TEXT,
  dni                  TEXT,
  cuit_cuil            TEXT,
  fecha_nacimiento     DATE,
  lugar_nacimiento     TEXT,
  nacionalidad         TEXT,
  profesion            TEXT,
  estado_civil         TEXT CHECK (estado_civil IN (
                         'soltero','casado','divorciado','viudo','union_convivencial')),
  nombre_conyuge       TEXT,
  apellido_conyuge     TEXT,

  -- Domicilio particular
  dom_calle            TEXT,
  dom_numero           TEXT,
  dom_piso             TEXT,
  dom_depto            TEXT,
  dom_localidad        TEXT,
  dom_provincia        TEXT,
  dom_cp               TEXT,
  telefono_particular  TEXT,
  celular              TEXT,
  email                TEXT,

  -- Datos laborales
  trabaja              BOOLEAN,
  empresa              TEXT,
  cargo                TEXT,
  dom_laboral          TEXT,
  tel_laboral          TEXT,

  -- Situación habitacional
  alquila              BOOLEAN,
  alquila_mediante     TEXT CHECK (alquila_mediante IN ('inmobiliaria','particular')),
  nombre_inmobiliaria  TEXT,
  nombre_propietario   TEXT,

  -- Documentación (paths en storage)
  dni_frente_url       TEXT,
  dni_dorso_url        TEXT,

  completada           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(solicitud_id, numero_persona)
);

-- ── Audit log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes_audit (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id  BIGINT REFERENCES solicitudes(id) ON DELETE CASCADE,
  accion        TEXT NOT NULL,
  admin_email   TEXT,
  detalles      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_token  ON solicitudes(token);
CREATE INDEX IF NOT EXISTS idx_fichas_solicitud   ON fichas_personas(solicitud_id);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solicitudes_updated_at ON solicitudes;
CREATE TRIGGER solicitudes_updated_at
  BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS fichas_updated_at ON fichas_personas;
CREATE TRIGGER fichas_updated_at
  BEFORE UPDATE ON fichas_personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE solicitudes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas_personas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_audit ENABLE ROW LEVEL SECURITY;

-- Anónimo puede leer solicitudes (para el formulario público)
DROP POLICY IF EXISTS "solicitudes_anon_select" ON solicitudes;
CREATE POLICY "solicitudes_anon_select" ON solicitudes
  FOR SELECT TO anon
  USING (true);

-- Autenticado tiene acceso total
DROP POLICY IF EXISTS "solicitudes_auth_all" ON solicitudes;
CREATE POLICY "solicitudes_auth_all" ON solicitudes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Anónimo puede leer fichas
DROP POLICY IF EXISTS "fichas_anon_select" ON fichas_personas;
CREATE POLICY "fichas_anon_select" ON fichas_personas
  FOR SELECT TO anon USING (true);

-- Anónimo puede insertar fichas para solicitudes activas
DROP POLICY IF EXISTS "fichas_anon_insert" ON fichas_personas;
CREATE POLICY "fichas_anon_insert" ON fichas_personas
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM solicitudes s
      WHERE s.id = solicitud_id
        AND s.estado = 'pendiente'
        AND s.fecha_vencimiento > NOW()
    )
  );

-- Anónimo puede actualizar fichas de solicitudes activas
DROP POLICY IF EXISTS "fichas_anon_update" ON fichas_personas;
CREATE POLICY "fichas_anon_update" ON fichas_personas
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM solicitudes s
      WHERE s.id = solicitud_id
        AND s.estado = 'pendiente'
        AND s.fecha_vencimiento > NOW()
    )
  );

-- Anónimo puede marcar solicitud como completada (cambio de estado)
DROP POLICY IF EXISTS "solicitudes_anon_update_completar" ON solicitudes;
CREATE POLICY "solicitudes_anon_update_completar" ON solicitudes
  FOR UPDATE TO anon
  USING (estado = 'pendiente' AND fecha_vencimiento > NOW())
  WITH CHECK (true);

-- Autenticado tiene acceso total a fichas
DROP POLICY IF EXISTS "fichas_auth_all" ON fichas_personas;
CREATE POLICY "fichas_auth_all" ON fichas_personas
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Audit: solo admin
DROP POLICY IF EXISTS "audit_auth_all" ON solicitudes_audit;
CREATE POLICY "audit_auth_all" ON solicitudes_audit
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Storage bucket ────────────────────────────────────────────
-- Ejecutar en Supabase Dashboard → Storage → New Bucket:
-- Nombre: solicitudes-docs
-- Public: SÍ (para acceso directo a imágenes y PDFs)
-- Luego agregar política en Storage → Policies:
--
-- INSERT para anon (subida de DNI desde el formulario):
INSERT INTO storage.buckets (id, name, public)
VALUES ('solicitudes-docs', 'solicitudes-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage para anon (subir DNI)
DROP POLICY IF EXISTS "allow_anon_upload" ON storage.objects;
CREATE POLICY "allow_anon_upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'solicitudes-docs');

-- Política de storage para lectura pública
DROP POLICY IF EXISTS "allow_public_read" ON storage.objects;
CREATE POLICY "allow_public_read" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'solicitudes-docs');

-- Política de storage para admin
DROP POLICY IF EXISTS "allow_auth_all" ON storage.objects;
CREATE POLICY "allow_auth_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'solicitudes-docs')
  WITH CHECK (bucket_id = 'solicitudes-docs');

-- ✅ FIN DE LA MIGRACIÓN
-- Verificar con:
-- SELECT * FROM solicitudes LIMIT 1;
-- SELECT * FROM fichas_personas LIMIT 1;
