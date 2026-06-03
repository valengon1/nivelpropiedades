import { supabase } from "./supabase";
import {
  type Solicitud,
  type FichaPersona,
  mapDbSolicitud,
  mapDbFicha,
} from "@/types/solicitud";

const BUCKET = "solicitudes-docs";

// ── Solicitudes ───────────────────────────────────────────────

export async function getSolicitudes(): Promise<Solicitud[]> {
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => mapDbSolicitud(r as Record<string, unknown>));
}

export async function getSolicitudByIdAndToken(
  id: number,
  token: string
): Promise<Solicitud | null> {
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("id", id)
    .eq("token", token)
    .single();
  if (error || !data) return null;
  return mapDbSolicitud(data as Record<string, unknown>);
}

export async function createSolicitud(
  direccion: string,
  cantidadPersonas: number,
  nombreRef?: string
): Promise<Solicitud> {
  const { data, error } = await supabase
    .from("solicitudes")
    .insert({
      direccion,
      cantidad_personas: cantidadPersonas,
      nombre_ref: nombreRef || null,
    })
    .select()
    .single();
  if (error || !data) throw error || new Error("No se pudo crear la solicitud");
  return mapDbSolicitud(data as Record<string, unknown>);
}

export async function updateSolicitudEstado(
  id: number,
  estado: "pendiente" | "completada" | "vencida",
  extra?: { pdf_url?: string; zip_url?: string; fecha_completada?: string }
): Promise<void> {
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado, ...extra })
    .eq("id", id);
  if (error) throw error;
}

export async function regenerarTokenSolicitud(id: number): Promise<string> {
  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from("solicitudes")
    .update({
      token: newToken,
      estado: "pendiente",
      fecha_vencimiento: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return newToken;
}

export async function deleteSolicitud(id: number): Promise<void> {
  // Eliminar archivos de storage primero
  try {
    await deleteStorageFolder(`solicitud-${id}`);
  } catch {
    // Si falla el borrado de storage, continuar con el borrado de la DB
  }
  const { error } = await supabase
    .from("solicitudes")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Fichas de personas ────────────────────────────────────────

export async function getFichasPersonas(
  solicitudId: number
): Promise<FichaPersona[]> {
  const { data, error } = await supabase
    .from("fichas_personas")
    .select("*")
    .eq("solicitud_id", solicitudId)
    .order("numero_persona", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => mapDbFicha(r as Record<string, unknown>));
}

export async function upsertFichaPersona(
  ficha: Partial<FichaPersona> & { solicitud_id: number; numero_persona: number }
): Promise<FichaPersona> {
  const { id, created_at, updated_at, ...rest } = ficha as FichaPersona;
  void id; void created_at; void updated_at;

  // Convertir strings vacíos a null en campos con CHECK constraint en DB
  const payload = {
    ...rest,
    estado_civil: rest.estado_civil || null,
    alquila_mediante: rest.alquila_mediante || null,
    fecha_nacimiento: rest.fecha_nacimiento || null,
    // Strings vacíos opcionales → null para mantener el DB limpio
    nombre_conyuge: rest.nombre_conyuge || null,
    apellido_conyuge: rest.apellido_conyuge || null,
    dom_piso: rest.dom_piso || null,
    dom_depto: rest.dom_depto || null,
    telefono_particular: rest.telefono_particular || null,
    empresa: rest.empresa || null,
    cargo: rest.cargo || null,
    dom_laboral: rest.dom_laboral || null,
    tel_laboral: rest.tel_laboral || null,
    nombre_inmobiliaria: rest.nombre_inmobiliaria || null,
    nombre_propietario: rest.nombre_propietario || null,
    dni_frente_url: rest.dni_frente_url || null,
    dni_dorso_url: rest.dni_dorso_url || null,
  };

  const { data, error } = await supabase
    .from("fichas_personas")
    .upsert(payload, { onConflict: "solicitud_id,numero_persona" })
    .select()
    .single();
  if (error || !data) throw error || new Error("Error al guardar ficha");
  return mapDbFicha(data as Record<string, unknown>);
}

// ── Storage de documentos ─────────────────────────────────────

export async function uploadDniImage(
  solicitudId: number,
  numeroPersona: number,
  tipo: "frente" | "dorso",
  blob: Blob
): Promise<string> {
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `solicitud-${solicitudId}/persona-${numeroPersona}/${tipo}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { cacheControl: "3600", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteStorageFolder(folder: string): Promise<void> {
  const { data } = await supabase.storage.from(BUCKET).list(folder);
  if (!data || data.length === 0) return;
  const paths = data.map((f) => `${folder}/${f.name}`);
  await supabase.storage.from(BUCKET).remove(paths);
}

export async function uploadPdf(
  solicitudId: number,
  pdfBlob: Blob
): Promise<string> {
  const path = `solicitud-${solicitudId}/solicitud-${solicitudId}.pdf`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBlob, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: true,
    });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Audit log ─────────────────────────────────────────────────

export async function logAudit(
  solicitudId: number,
  accion: string,
  adminEmail?: string,
  detalles?: Record<string, unknown>
): Promise<void> {
  await supabase.from("solicitudes_audit").insert({
    solicitud_id: solicitudId,
    accion,
    admin_email: adminEmail || null,
    detalles: detalles || null,
  });
}

// ── Helpers ───────────────────────────────────────────────────

export function buildFichaUrl(id: number, token: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://nivelpropiedades.com";
  const isLocal =
    typeof window !== "undefined" && window.location.hostname === "localhost";
  // En localhost el redirect de Netlify no existe, usamos query param para el ID
  if (isLocal) return `${base}/ficha/index?id=${id}&t=${token}`;
  return `${base}/ficha/${id}?t=${token}`;
}

export function isExpired(solicitud: Solicitud): boolean {
  return (
    solicitud.estado === "vencida" ||
    (solicitud.estado === "pendiente" &&
      new Date(solicitud.fecha_vencimiento) < new Date())
  );
}

export function formatFecha(isoString: string): string {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
