// ── Solicitud (tabla principal) ───────────────────────────────
export type SolicitudEstado = "pendiente" | "completada" | "vencida";

export interface Solicitud {
  id: number;
  token: string;
  direccion: string;
  nombre_ref: string | null;
  cantidad_personas: number;
  estado: SolicitudEstado;
  fecha_vencimiento: string;
  fecha_completada: string | null;
  pdf_url: string | null;
  zip_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Ficha de una persona ─────────────────────────────────────
export type EstadoCivil =
  | "soltero"
  | "casado"
  | "divorciado"
  | "viudo"
  | "union_convivencial";

export type AlquilaMediante = "inmobiliaria" | "particular";

export interface FichaPersona {
  id?: number;
  solicitud_id: number;
  numero_persona: number;
  paso_completado: number;

  // Datos personales
  nombre: string;
  apellido: string;
  dni: string;
  cuit_cuil: string;
  fecha_nacimiento: string;
  lugar_nacimiento: string;
  nacionalidad: string;
  profesion: string;
  estado_civil: EstadoCivil | "";
  nombre_conyuge: string;
  apellido_conyuge: string;

  // Domicilio
  dom_calle: string;
  dom_numero: string;
  dom_piso: string;
  dom_depto: string;
  dom_localidad: string;
  dom_provincia: string;
  dom_cp: string;
  telefono_particular: string;
  celular: string;
  email: string;

  // Laboral
  trabaja: boolean | null;
  empresa: string;
  cargo: string;
  dom_laboral: string;
  tel_laboral: string;

  // Habitacional
  alquila: boolean | null;
  alquila_mediante: AlquilaMediante | "";
  nombre_inmobiliaria: string;
  nombre_propietario: string;

  // Documentación
  dni_frente_url: string;
  dni_dorso_url: string;

  completada: boolean;
  created_at?: string;
  updated_at?: string;
}

export const EMPTY_FICHA_PERSONA = (solicitudId: number, numeroPersna: number): FichaPersona => ({
  solicitud_id: solicitudId,
  numero_persona: numeroPersna,
  paso_completado: 0,
  nombre: "", apellido: "", dni: "", cuit_cuil: "",
  fecha_nacimiento: "", lugar_nacimiento: "", nacionalidad: "Argentina",
  profesion: "", estado_civil: "", nombre_conyuge: "", apellido_conyuge: "",
  dom_calle: "", dom_numero: "", dom_piso: "", dom_depto: "",
  dom_localidad: "", dom_provincia: "Buenos Aires", dom_cp: "",
  telefono_particular: "", celular: "", email: "",
  trabaja: null, empresa: "", cargo: "", dom_laboral: "", tel_laboral: "",
  alquila: null, alquila_mediante: "", nombre_inmobiliaria: "", nombre_propietario: "",
  dni_frente_url: "", dni_dorso_url: "",
  completada: false,
});

// ── Pasos del formulario ─────────────────────────────────────
export type FormStep =
  | "personal"
  | "domicilio"
  | "laboral"
  | "habitacional"
  | "documentacion"
  | "revision";

export const FORM_STEPS: FormStep[] = [
  "personal",
  "domicilio",
  "laboral",
  "habitacional",
  "documentacion",
  "revision",
];

export const STEP_LABELS: Record<FormStep, string> = {
  personal: "Datos personales",
  domicilio: "Domicilio",
  laboral: "Datos laborales",
  habitacional: "Situación habitacional",
  documentacion: "Documentación",
  revision: "Revisión",
};

// ── Estado civil display ─────────────────────────────────────
export const ESTADO_CIVIL_LABELS: Record<EstadoCivil, string> = {
  soltero: "Soltero/a",
  casado: "Casado/a",
  divorciado: "Divorciado/a",
  viudo: "Viudo/a",
  union_convivencial: "Unión convivencial",
};

export function mapDbSolicitud(r: Record<string, unknown>): Solicitud {
  return {
    id: r.id as number,
    token: r.token as string,
    direccion: (r.direccion as string) || "",
    nombre_ref: (r.nombre_ref as string) || null,
    cantidad_personas: (r.cantidad_personas as number) || 1,
    estado: (r.estado as SolicitudEstado) || "pendiente",
    fecha_vencimiento: (r.fecha_vencimiento as string) || "",
    fecha_completada: (r.fecha_completada as string) || null,
    pdf_url: (r.pdf_url as string) || null,
    zip_url: (r.zip_url as string) || null,
    created_at: (r.created_at as string) || "",
    updated_at: (r.updated_at as string) || "",
  };
}

export function mapDbFicha(r: Record<string, unknown>): FichaPersona {
  return {
    id: r.id as number,
    solicitud_id: r.solicitud_id as number,
    numero_persona: r.numero_persona as number,
    paso_completado: (r.paso_completado as number) || 0,
    nombre: (r.nombre as string) || "",
    apellido: (r.apellido as string) || "",
    dni: (r.dni as string) || "",
    cuit_cuil: (r.cuit_cuil as string) || "",
    fecha_nacimiento: (r.fecha_nacimiento as string) || "",
    lugar_nacimiento: (r.lugar_nacimiento as string) || "",
    nacionalidad: (r.nacionalidad as string) || "Argentina",
    profesion: (r.profesion as string) || "",
    estado_civil: (r.estado_civil as EstadoCivil) || "",
    nombre_conyuge: (r.nombre_conyuge as string) || "",
    apellido_conyuge: (r.apellido_conyuge as string) || "",
    dom_calle: (r.dom_calle as string) || "",
    dom_numero: (r.dom_numero as string) || "",
    dom_piso: (r.dom_piso as string) || "",
    dom_depto: (r.dom_depto as string) || "",
    dom_localidad: (r.dom_localidad as string) || "",
    dom_provincia: (r.dom_provincia as string) || "Buenos Aires",
    dom_cp: (r.dom_cp as string) || "",
    telefono_particular: (r.telefono_particular as string) || "",
    celular: (r.celular as string) || "",
    email: (r.email as string) || "",
    trabaja: r.trabaja === null || r.trabaja === undefined ? null : Boolean(r.trabaja),
    empresa: (r.empresa as string) || "",
    cargo: (r.cargo as string) || "",
    dom_laboral: (r.dom_laboral as string) || "",
    tel_laboral: (r.tel_laboral as string) || "",
    alquila: r.alquila === null || r.alquila === undefined ? null : Boolean(r.alquila),
    alquila_mediante: (r.alquila_mediante as AlquilaMediante) || "",
    nombre_inmobiliaria: (r.nombre_inmobiliaria as string) || "",
    nombre_propietario: (r.nombre_propietario as string) || "",
    dni_frente_url: (r.dni_frente_url as string) || "",
    dni_dorso_url: (r.dni_dorso_url as string) || "",
    completada: Boolean(r.completada),
    created_at: (r.created_at as string) || "",
    updated_at: (r.updated_at as string) || "",
  };
}
