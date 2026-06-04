"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Clock } from "lucide-react";
import { buildWhatsappLink } from "@/lib/utils";
import {
  type Solicitud,
  type FichaPersona,
  type FormStep,
  type EstadoCivil,
  type AlquilaMediante,
  FORM_STEPS,
  STEP_LABELS,
  ESTADO_CIVIL_LABELS,
  EMPTY_FICHA_PERSONA,
} from "@/types/solicitud";
import {
  getSolicitudByIdAndToken,
  getFichasPersonas,
  upsertFichaPersona,
  uploadDniImage,
  updateSolicitudEstado,
  uploadPdf,
  isExpired,
  buildFichaUrl,
} from "@/lib/solicitudes";
import { generateSolicitudPdf } from "@/lib/pdfGenerator";
import { DniCapture } from "./DniCapture";

// ── Helpers ───────────────────────────────────────────────────

const LS_KEY = (id: number) => `ficha_draft_${id}`;

function saveDraft(solicitudId: number, data: Record<number, FichaPersona>, persona: number, step: FormStep) {
  try {
    localStorage.setItem(LS_KEY(solicitudId), JSON.stringify({ data, persona, step }));
  } catch {}
}

function loadDraft(solicitudId: number): { data: Record<number, FichaPersona>; persona: number; step: FormStep } | null {
  try {
    const raw = localStorage.getItem(LS_KEY(solicitudId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft(solicitudId: number) {
  try { localStorage.removeItem(LS_KEY(solicitudId)); } catch {}
}

// ── Sub-componentes de sección ────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold tracking-[0.07em] uppercase text-[#6b6b6b] mb-1.5">
      {children}
    </label>
  );
}

function Field({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-1 ${className}`}>{children}</div>;
}

// Filtra solo letras y espacios (sin números ni caracteres especiales)
function onlyLetters(v: string): string {
  return v.replace(/[^a-zA-ZÀ-ÿÑñ\s\-']/g, "");
}

// Filtra solo dígitos y guiones (para DNI, CUIT, teléfonos)
function onlyNums(v: string, extraChars = ""): string {
  const escaped = extraChars.replace(/[-]/g, "\\-");
  return v.replace(new RegExp(`[^0-9${escaped}]`, "g"), "");
}

function Input({
  value, onChange, placeholder = "", type = "text", required = false,
  className = "", inputMode, maxLength, filter,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  required?: boolean; className?: string;
  inputMode?: "numeric" | "tel" | "email" | "text" | "decimal";
  maxLength?: number;
  filter?: "letters" | "numeric" | "tel";
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (filter === "letters") v = onlyLetters(v);
    if (filter === "numeric") v = onlyNums(v);
    if (filter === "tel")     v = onlyNums(v, "-()+ ");
    onChange(v);
  };
  return (
    <input
      type={type}
      required={required}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      autoComplete="off"
      className={`w-full h-11 border border-[#e0e0dc] bg-white px-3 text-[14px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none rounded-sm transition-colors ${className}`}
    />
  );
}

function Select({
  value, onChange, options, placeholder = "Seleccionar...",
}: {
  value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 border border-[#e0e0dc] bg-white px-3 text-[14px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none rounded-sm appearance-none transition-colors"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SiNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-3">
        {([true, false] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 h-11 border text-[13px] font-semibold transition-colors rounded-sm ${
              value === v
                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                : "bg-white text-[#6b6b6b] border-[#e0e0dc] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
            }`}
          >
            {v ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#e8e8e4] rounded-sm overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-[#e8e8e4] bg-[#fafaf8]">
        <h3 className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#0a0a0a]">{title}</h3>
      </div>
      <div className="p-5 grid gap-4">{children}</div>
    </div>
  );
}

// ── Secciones del formulario ──────────────────────────────────

function StepPersonal({
  ficha, onChange,
}: { ficha: FichaPersona; onChange: (f: Partial<FichaPersona>) => void }) {
  const needsConyuge = ficha.estado_civil === "casado" || ficha.estado_civil === "union_convivencial";
  return (
    <div>
      <SectionCard title="Datos personales">
        <div className="grid grid-cols-2 gap-4">
          <Field><Label>Nombre *</Label><Input required filter="letters" value={ficha.nombre} onChange={(v) => onChange({ nombre: v })} placeholder="María" /></Field>
          <Field><Label>Apellido *</Label><Input required filter="letters" value={ficha.apellido} onChange={(v) => onChange({ apellido: v })} placeholder="González" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field><Label>DNI *</Label><Input required inputMode="numeric" filter="numeric" maxLength={9} value={ficha.dni} onChange={(v) => onChange({ dni: v })} placeholder="28123456" /></Field>
          <Field><Label>CUIT / CUIL *</Label><Input required inputMode="numeric" filter="tel" maxLength={13} value={ficha.cuit_cuil} onChange={(v) => onChange({ cuit_cuil: v })} placeholder="27-28123456-4" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label>Fecha de nacimiento *</Label>
            <Input required type="date" value={ficha.fecha_nacimiento} onChange={(v) => onChange({ fecha_nacimiento: v })} />
          </Field>
          <Field><Label>Lugar de nacimiento</Label><Input filter="letters" value={ficha.lugar_nacimiento} onChange={(v) => onChange({ lugar_nacimiento: v })} placeholder="Buenos Aires" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field><Label>Nacionalidad</Label><Input filter="letters" value={ficha.nacionalidad} onChange={(v) => onChange({ nacionalidad: v })} placeholder="Argentina" /></Field>
          <Field><Label>Profesión</Label><Input filter="letters" value={ficha.profesion} onChange={(v) => onChange({ profesion: v })} placeholder="Contador/a" /></Field>
        </div>
        <Field>
          <Label>Estado civil *</Label>
          <Select
            value={ficha.estado_civil}
            onChange={(v) => onChange({ estado_civil: v as EstadoCivil })}
            options={Object.entries(ESTADO_CIVIL_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Field>
      </SectionCard>

      {needsConyuge && (
        <SectionCard title="Datos del cónyuge">
          <div className="grid grid-cols-2 gap-4">
            <Field><Label>Nombre del cónyuge</Label><Input filter="letters" value={ficha.nombre_conyuge} onChange={(v) => onChange({ nombre_conyuge: v })} placeholder="Juan" /></Field>
            <Field><Label>Apellido del cónyuge</Label><Input filter="letters" value={ficha.apellido_conyuge} onChange={(v) => onChange({ apellido_conyuge: v })} placeholder="García" /></Field>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function StepDomicilio({ ficha, onChange }: { ficha: FichaPersona; onChange: (f: Partial<FichaPersona>) => void }) {
  const PROVINCIAS = ["Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];
  return (
    <SectionCard title="Domicilio particular">
      <div className="grid grid-cols-3 gap-4">
        <Field className="col-span-2">
          <Label>Calle *</Label>
          <Input required value={ficha.dom_calle} onChange={(v) => onChange({ dom_calle: v })} placeholder="Av. Álvarez Thomas" />
        </Field>
        <Field>
          <Label>Número *</Label>
          <Input required inputMode="numeric" filter="numeric" maxLength={6} value={ficha.dom_numero} onChange={(v) => onChange({ dom_numero: v })} placeholder="1234" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label>Piso <span className="text-[#c0c0c0] font-normal normal-case tracking-normal">(opcional)</span></Label>
          <Input inputMode="numeric" filter="numeric" maxLength={3} value={ficha.dom_piso} onChange={(v) => onChange({ dom_piso: v })} placeholder="3" />
        </Field>
        <Field>
          <Label>Departamento <span className="text-[#c0c0c0] font-normal normal-case tracking-normal">(opcional)</span></Label>
          <Input maxLength={4} value={ficha.dom_depto} onChange={(v) => onChange({ dom_depto: v })} placeholder="B" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label>Localidad *</Label>
          <Input required value={ficha.dom_localidad} onChange={(v) => onChange({ dom_localidad: v })} placeholder="Ramos Mejía" />
        </Field>
        <Field>
          <Label>Provincia *</Label>
          <Select value={ficha.dom_provincia} onChange={(v) => onChange({ dom_provincia: v })} options={PROVINCIAS.map((p) => ({ value: p, label: p }))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field>
          <Label>Código postal *</Label>
          <Input required inputMode="numeric" filter="numeric" maxLength={8} value={ficha.dom_cp} onChange={(v) => onChange({ dom_cp: v })} placeholder="1704" />
        </Field>
        <Field>
          <Label>Tel. particular *</Label>
          <Input required type="tel" filter="tel" inputMode="tel" value={ficha.telefono_particular} onChange={(v) => onChange({ telefono_particular: v })} placeholder="011 4xxx-xxxx" />
        </Field>
        <Field>
          <Label>Celular *</Label>
          <Input required type="tel" filter="tel" inputMode="tel" value={ficha.celular} onChange={(v) => onChange({ celular: v })} placeholder="11 xxxx-xxxx" />
        </Field>
      </div>
      <Field>
        <Label>Email *</Label>
        <Input required type="email" inputMode="email" value={ficha.email} onChange={(v) => onChange({ email: v })} placeholder="nombre@email.com" />
      </Field>
    </SectionCard>
  );
}

function StepLaboral({ ficha, onChange }: { ficha: FichaPersona; onChange: (f: Partial<FichaPersona>) => void }) {
  return (
    <SectionCard title="Datos laborales">
      <SiNo value={ficha.trabaja} onChange={(v) => onChange({ trabaja: v })} label="¿Trabaja actualmente?" />
      {ficha.trabaja === true && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field><Label>Empresa / Empleador</Label><Input value={ficha.empresa} onChange={(v) => onChange({ empresa: v })} placeholder="ACME S.A." /></Field>
            <Field><Label>Cargo / Puesto</Label><Input value={ficha.cargo} onChange={(v) => onChange({ cargo: v })} placeholder="Analista" /></Field>
          </div>
          <Field><Label>Domicilio laboral</Label><Input value={ficha.dom_laboral} onChange={(v) => onChange({ dom_laboral: v })} placeholder="Av. Corrientes 1234, CABA" /></Field>
          <Field><Label>Teléfono laboral</Label><Input type="tel" value={ficha.tel_laboral} onChange={(v) => onChange({ tel_laboral: v })} placeholder="011 4xxx-xxxx" /></Field>
        </>
      )}
      {ficha.trabaja === false && (
        <div className="py-2 px-4 bg-[#f7f7f6] border border-[#e8e8e4] text-[13px] text-[#6b6b6b]">
          No se requieren datos laborales.
        </div>
      )}
    </SectionCard>
  );
}

function StepHabitacional({ ficha, onChange }: { ficha: FichaPersona; onChange: (f: Partial<FichaPersona>) => void }) {
  return (
    <SectionCard title="Situación habitacional">
      <SiNo value={ficha.alquila} onChange={(v) => onChange({ alquila: v })} label="¿Alquila actualmente?" />
      {ficha.alquila === true && (
        <>
          <Field>
            <Label>¿Alquila mediante?</Label>
            <Select
              value={ficha.alquila_mediante}
              onChange={(v) => onChange({ alquila_mediante: v as AlquilaMediante })}
              options={[
                { value: "inmobiliaria", label: "Inmobiliaria" },
                { value: "particular", label: "Propietario particular" },
              ]}
            />
          </Field>
          {ficha.alquila_mediante === "inmobiliaria" && (
            <Field><Label>Nombre de la inmobiliaria</Label><Input value={ficha.nombre_inmobiliaria} onChange={(v) => onChange({ nombre_inmobiliaria: v })} placeholder="García Propiedades" /></Field>
          )}
          {ficha.alquila_mediante === "particular" && (
            <Field><Label>Nombre y apellido del propietario</Label><Input value={ficha.nombre_propietario} onChange={(v) => onChange({ nombre_propietario: v })} placeholder="Roberto Martínez" /></Field>
          )}
        </>
      )}
      {ficha.alquila === false && (
        <div className="py-2 px-4 bg-[#f7f7f6] border border-[#e8e8e4] text-[13px] text-[#6b6b6b]">
          No se requieren datos de situación habitacional.
        </div>
      )}
    </SectionCard>
  );
}

function StepDocumentacion({
  ficha, onUpload, uploading,
}: { ficha: FichaPersona; onUpload: (tipo: "frente" | "dorso", blob: Blob, preview: string) => void; uploading: Record<string, boolean> }) {
  return (
    <div>
      <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-sm flex gap-3 items-start">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-800">
          Las fotos del DNI deben ser legibles. Asegurate de que el documento esté bien iluminado y sin reflejos.
        </p>
      </div>
      <div className="grid gap-4">
        <div>
          <DniCapture
            tipo="frente"
            currentUrl={ficha.dni_frente_url}
            onConfirm={(blob, preview) => onUpload("frente", blob, preview)}
            disabled={uploading["frente"]}
          />
          {uploading["frente"] && (
            <p className="text-[11px] text-[#6b6b6b] mt-1 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Subiendo…
            </p>
          )}
        </div>
        <div>
          <DniCapture
            tipo="dorso"
            currentUrl={ficha.dni_dorso_url}
            onConfirm={(blob, preview) => onUpload("dorso", blob, preview)}
            disabled={uploading["dorso"]}
          />
          {uploading["dorso"] && (
            <p className="text-[11px] text-[#6b6b6b] mt-1 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Subiendo…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRevision({ ficha }: { ficha: FichaPersona }) {
  const row = (label: string, value: string) => (
    <div className="flex gap-3 py-2 border-b border-[#f0f0ec] last:border-0">
      <span className="text-[11px] font-bold text-[#a3a3a3] w-36 flex-shrink-0">{label}</span>
      <span className="text-[13px] text-[#0a0a0a]">{value || "-"}</span>
    </div>
  );
  const ecLabel = ESTADO_CIVIL_LABELS[ficha.estado_civil as keyof typeof ESTADO_CIVIL_LABELS] || "-";
  return (
    <div>
      <SectionCard title="Datos personales">
        {row("Nombre", ficha.nombre)}
        {row("Apellido", ficha.apellido)}
        {row("DNI", ficha.dni)}
        {row("CUIT / CUIL", ficha.cuit_cuil)}
        {row("F. Nacimiento", ficha.fecha_nacimiento ? new Date(ficha.fecha_nacimiento + "T00:00:00").toLocaleDateString("es-AR") : "-")}
        {row("Lugar Nac.", ficha.lugar_nacimiento)}
        {row("Nacionalidad", ficha.nacionalidad)}
        {row("Profesión", ficha.profesion)}
        {row("Estado civil", ecLabel)}
        {(ficha.estado_civil === "casado" || ficha.estado_civil === "union_convivencial") &&
          row("Cónyuge", `${ficha.nombre_conyuge} ${ficha.apellido_conyuge}`.trim())}
      </SectionCard>
      <SectionCard title="Domicilio">
        {row("Calle y número", `${ficha.dom_calle} ${ficha.dom_numero}`)}
        {(ficha.dom_piso || ficha.dom_depto) && row("Piso / Depto", `${ficha.dom_piso} ${ficha.dom_depto}`.trim())}
        {row("Localidad", ficha.dom_localidad)}
        {row("Provincia", ficha.dom_provincia)}
        {row("Código postal", ficha.dom_cp)}
        {row("Teléfono", ficha.telefono_particular)}
        {row("Celular", ficha.celular)}
        {row("Email", ficha.email)}
      </SectionCard>
      <SectionCard title="Laboral">
        {row("Trabaja", ficha.trabaja === null ? "-" : ficha.trabaja ? "Sí" : "No")}
        {ficha.trabaja && row("Empresa", ficha.empresa)}
        {ficha.trabaja && row("Cargo", ficha.cargo)}
        {ficha.trabaja && row("Dom. laboral", ficha.dom_laboral)}
      </SectionCard>
      <SectionCard title="Habitacional">
        {row("¿Alquila?", ficha.alquila === null ? "-" : ficha.alquila ? "Sí" : "No")}
        {ficha.alquila && row("Mediante", ficha.alquila_mediante === "inmobiliaria" ? `Inmobiliaria: ${ficha.nombre_inmobiliaria}` : `Propietario: ${ficha.nombre_propietario}`)}
      </SectionCard>
      <SectionCard title="Documentación">
        <div className="grid grid-cols-2 gap-4">
          {["frente", "dorso"].map((tipo) => {
            const url = tipo === "frente" ? ficha.dni_frente_url : ficha.dni_dorso_url;
            return (
              <div key={tipo}>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#a3a3a3] mb-2">
                  DNI {tipo === "frente" ? "Frente" : "Dorso"}
                </p>
                {url ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`DNI ${tipo}`} className="h-16 object-contain border border-[#e8e8e4]" />
                    <span className="text-green-700 font-semibold text-[11px]">✓ Cargado</span>
                  </div>
                ) : (
                  <span className="text-red-600 text-[12px] font-medium">✗ Falta cargar</span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

type Screen = "loading" | "not_found" | "expired" | "completed" | "welcome" | "form" | "declaration" | "generating" | "done";

export function FichaFormWrapper() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [fichas, setFichas] = useState<Record<number, FichaPersona>>({});
  const [currentPersona, setCurrentPersona] = useState(1);
  const [currentStep, setCurrentStep] = useState<FormStep>("personal");
  const [dniUploading, setDniUploading] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const savedRef = useRef(false);

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const lastSegment = pathParts[pathParts.length - 1];
      // En localhost el link tiene formato /ficha/index?id=152&t=TOKEN
      // En producción tiene formato /ficha/152?t=TOKEN
      const rawId = lastSegment === "index" ? (params.get("id") || "") : lastSegment;
      const id = parseInt(rawId, 10);
      const token = params.get("t") || "";

      if (!id || isNaN(id) || !token) { setScreen("not_found"); return; }

      const sol = await getSolicitudByIdAndToken(id, token);
      if (!sol) { setScreen("not_found"); return; }

      if (sol.estado === "completada") { setSolicitud(sol); setScreen("completed"); return; }
      if (isExpired(sol)) { setSolicitud(sol); setScreen("expired"); return; }

      setSolicitud(sol);

      // Cargar fichas existentes
      let existingFichas: Record<number, FichaPersona> = {};
      try {
        const dbFichas = await getFichasPersonas(id);
        dbFichas.forEach((f) => { existingFichas[f.numero_persona] = f; });
      } catch {}

      // Cargar draft local
      const draft = loadDraft(id);

      // Merge: DB toma precedencia para completadas, draft para en-progreso
      const merged: Record<number, FichaPersona> = {};
      for (let i = 1; i <= sol.cantidad_personas; i++) {
        const dbF = existingFichas[i];
        const draftF = draft?.data?.[i];
        if (dbF?.completada) {
          merged[i] = dbF;
        } else if (draftF) {
          merged[i] = { ...(dbF || EMPTY_FICHA_PERSONA(id, i)), ...draftF };
        } else {
          merged[i] = dbF || EMPTY_FICHA_PERSONA(id, i);
        }
      }
      setFichas(merged);

      // Determinar persona y paso a continuar
      if (draft && !existingFichas[draft.persona]?.completada) {
        setCurrentPersona(draft.persona);
        setCurrentStep(draft.step);
      } else {
        // Encontrar primera persona no completada
        let nextPersona = 1;
        for (let i = 1; i <= sol.cantidad_personas; i++) {
          if (!merged[i]?.completada) { nextPersona = i; break; }
        }
        setCurrentPersona(nextPersona);
        setCurrentStep("personal");
      }

      const allDone = Object.values(merged).every((f) => f.completada);
      if (allDone) {
        setScreen("declaration");
      } else {
        setScreen("welcome");
      }
    };
    init();
  }, []);

  const currentFicha = fichas[currentPersona] || EMPTY_FICHA_PERSONA(solicitud?.id || 0, currentPersona);

  const updateFicha = useCallback((changes: Partial<FichaPersona>) => {
    setFichas((prev) => {
      const updated = { ...prev, [currentPersona]: { ...currentFicha, ...changes } };
      if (solicitud) saveDraft(solicitud.id, updated, currentPersona, currentStep);
      return updated;
    });
  }, [currentPersona, currentFicha, currentStep, solicitud]);

  // ── DNI upload ────────────────────────────────────────────
  const handleDniUpload = async (tipo: "frente" | "dorso", blob: Blob, preview: string) => {
    if (!solicitud) return;
    setDniUploading((p) => ({ ...p, [tipo]: true }));
    try {
      const url = await uploadDniImage(solicitud.id, currentPersona, tipo, blob);
      const key = tipo === "frente" ? "dni_frente_url" : "dni_dorso_url";
      updateFicha({ [key]: url });
      // Guardar en Supabase inmediatamente
      await upsertFichaPersona({
        ...currentFicha,
        solicitud_id: solicitud.id,
        numero_persona: currentPersona,
        [key]: url,
      });
    } catch {
      // El preview local ya está guardado; continuar
    } finally {
      setDniUploading((p) => ({ ...p, [tipo]: false }));
    }
  };

  // ── Navegación ────────────────────────────────────────────
  const stepIndex = FORM_STEPS.indexOf(currentStep);

  const validateCurrentStep = (): string => {
    const f = currentFicha;
    if (currentStep === "personal") {
      if (!f.nombre.trim()) return "El nombre es obligatorio";
      if (f.nombre.trim().length < 3) return "El nombre debe tener al menos 3 caracteres";
      if (!f.apellido.trim()) return "El apellido es obligatorio";
      if (f.apellido.trim().length < 3) return "El apellido debe tener al menos 3 caracteres";
      if (!f.dni.trim()) return "El DNI es obligatorio";
      if (f.dni.trim().length < 7) return "El DNI no parece válido";
      if (!f.cuit_cuil.trim()) return "El CUIT/CUIL es obligatorio";
      if (!f.fecha_nacimiento) return "La fecha de nacimiento es obligatoria";
      if (!f.estado_civil) return "El estado civil es obligatorio";
    }
    if (currentStep === "domicilio") {
      if (!f.dom_calle.trim()) return "La calle es obligatoria";
      if (!f.dom_numero.trim()) return "El número de calle es obligatorio";
      if (!f.dom_localidad.trim()) return "La localidad es obligatoria";
      if (!f.dom_provincia) return "La provincia es obligatoria";
      if (!f.dom_cp.trim()) return "El código postal es obligatorio";
      if (!f.telefono_particular.trim()) return "El teléfono particular es obligatorio";
      if (!f.celular.trim()) return "El celular es obligatorio";
      if (!f.email.trim()) return "El email es obligatorio";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "El email no es válido";
    }
    if (currentStep === "laboral") {
      if (f.trabaja === null) return "Indicá si trabajás actualmente";
    }
    if (currentStep === "habitacional") {
      if (f.alquila === null) return "Indicá si alquilás actualmente";
    }
    if (currentStep === "documentacion") {
      if (!f.dni_frente_url) return "El DNI Frente es obligatorio";
      if (!f.dni_dorso_url) return "El DNI Dorso es obligatorio";
    }
    return "";
  };

  const goNext = async () => {
    const error = validateCurrentStep();
    if (error) { setSubmitError(error); return; }
    setSubmitError("");

    if (currentStep === "revision") {
      // Guardar persona como completada
      setSaving(true);
      try {
        await upsertFichaPersona({
          ...currentFicha,
          solicitud_id: solicitud!.id,
          numero_persona: currentPersona,
          completada: true,
          paso_completado: 6,
        });
        setFichas((prev) => ({
          ...prev,
          [currentPersona]: { ...prev[currentPersona], completada: true },
        }));

        if (currentPersona < (solicitud?.cantidad_personas || 1)) {
          const next = currentPersona + 1;
          setCurrentPersona(next);
          setCurrentStep("personal");
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          clearDraft(solicitud!.id);
          setScreen("declaration");
        }
      } catch {
        setSubmitError("Error al guardar. Intentá de nuevo.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Autoguardar paso actual en Supabase
    setSaving(true);
    try {
      await upsertFichaPersona({
        ...currentFicha,
        solicitud_id: solicitud!.id,
        numero_persona: currentPersona,
        paso_completado: stepIndex + 1,
      });
    } catch {}
    setSaving(false);

    const nextStep = FORM_STEPS[stepIndex + 1];
    setCurrentStep(nextStep);
    if (solicitud) saveDraft(solicitud.id, fichas, currentPersona, nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setSubmitError("");
    if (currentStep === "personal" && currentPersona > 1) {
      setCurrentPersona((p) => p - 1);
      setCurrentStep("revision");
    } else if (stepIndex > 0) {
      const prev = FORM_STEPS[stepIndex - 1];
      setCurrentStep(prev);
      if (solicitud) saveDraft(solicitud.id, fichas, currentPersona, prev);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Finalizar ─────────────────────────────────────────────
  const handleFinalizar = async () => {
    if (!declaration) { setSubmitError("Debe aceptar la declaración para continuar."); return; }
    if (!solicitud || savedRef.current) return;
    savedRef.current = true;
    setGeneratingPdf(true);
    setScreen("generating");
    try {
      const fichasArray = Object.values(fichas).sort((a, b) => a.numero_persona - b.numero_persona);
      const pdfBlob = await generateSolicitudPdf(solicitud, fichasArray);
      const pdfUrl = await uploadPdf(solicitud.id, pdfBlob);
      await updateSolicitudEstado(solicitud.id, "completada", {
        pdf_url: pdfUrl,
        fecha_completada: new Date().toISOString(),
      });
      clearDraft(solicitud.id);
      setScreen("done");
    } catch {
      savedRef.current = false;
      setSubmitError("Error al enviar la solicitud. Intentá de nuevo.");
      setScreen("declaration");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── Renders de pantalla ───────────────────────────────────

  if (screen === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f7f6]">
        <Loader2 size={32} className="animate-spin text-[#0a0a0a]" />
      </div>
    );
  }

  if (screen === "not_found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f6] px-5 text-center">
        <AlertTriangle size={40} className="text-[#a3a3a3] mb-4" />
        <h1 className="text-xl font-bold text-[#0a0a0a] mb-2">Solicitud no encontrada</h1>
        <p className="text-[14px] text-[#6b6b6b] max-w-sm">
          El enlace utilizado no es válido. Por favor solicitá un nuevo enlace a la inmobiliaria.
        </p>
      </div>
    );
  }

  if (screen === "expired") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f6] px-5 text-center">
        <Clock size={40} className="text-amber-500 mb-4" />
        <h1 className="text-xl font-bold text-[#0a0a0a] mb-2">Esta solicitud ha vencido</h1>
        <p className="text-[14px] text-[#6b6b6b] max-w-sm">
          Por favor solicitá un nuevo enlace a la inmobiliaria para continuar.
        </p>
      </div>
    );
  }

  if (screen === "completed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f6] px-5 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <Check size={28} className="text-green-700" />
        </div>
        <h1 className="text-xl font-bold text-[#0a0a0a] mb-2">Solicitud completada con éxito</h1>
        <p className="text-[14px] text-[#6b6b6b] max-w-sm">
          La información ya fue enviada a Nivel Propiedades.
          <br />No es necesario realizar ninguna acción adicional.
        </p>
        <a
          href={buildWhatsappLink("Hola, acabo de completar mi ficha de datos. Quedo a disposición.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center gap-2 px-5 h-11 bg-[#25d366] text-white text-[13px] font-semibold rounded-full hover:bg-[#1ebe5d] transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.25a.75.75 0 0 0 .923.923l5.375-1.478A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.694 9.694 0 0 1-4.94-1.352l-.354-.21-3.668 1.008 1.008-3.668-.21-.354A9.694 9.694 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
          </svg>
          Avisar por WhatsApp
        </a>
      </div>
    );
  }

  if (screen === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f6] px-5 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <Check size={28} className="text-green-700" />
        </div>
        <h1 className="text-2xl font-bold text-[#0a0a0a] mb-3" style={{ letterSpacing: "-0.03em" }}>
          ¡Solicitud enviada con éxito!
        </h1>
        <p className="text-[14px] text-[#6b6b6b] max-w-sm">
          La información ya fue enviada a Nivel Propiedades.
          <br />No es necesario realizar ninguna acción adicional.
        </p>
        <a
          href={buildWhatsappLink("Hola, acabo de completar mi ficha de datos. Quedo a disposición.")}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center gap-2 px-5 h-11 bg-[#25d366] text-white text-[13px] font-semibold rounded-full hover:bg-[#1ebe5d] transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.559 4.14 1.535 5.875L.057 23.25a.75.75 0 0 0 .923.923l5.375-1.478A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.694 9.694 0 0 1-4.94-1.352l-.354-.21-3.668 1.008 1.008-3.668-.21-.354A9.694 9.694 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
          </svg>
          Avisar por WhatsApp
        </a>
      </div>
    );
  }

  if (screen === "generating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f7f6] px-5 text-center">
        <Loader2 size={36} className="animate-spin text-[#0a0a0a] mb-5" />
        <h2 className="text-lg font-bold text-[#0a0a0a] mb-2">Generando ficha…</h2>
        <p className="text-[13px] text-[#6b6b6b]">
          Estamos preparando el PDF con toda la información.
        </p>
      </div>
    );
  }

  if (!solicitud) return null;

  // ─ Barra de progreso ─────────────────────────────────────
  const progressPct = Math.round(((currentPersona - 1) / solicitud.cantidad_personas) * 100);
  const stepPct = Math.round((stepIndex / (FORM_STEPS.length - 1)) * 100);

  const Header = () => (
    <div className="bg-white border-b border-[#e8e8e4] sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="relative h-8 w-24">
            <Image src="/logo-header.png" alt="Nivel Propiedades" fill className="object-contain object-left" />
          </div>
          {screen === "form" && (
            <span className="text-[11px] font-bold text-[#6b6b6b] tracking-[0.07em] uppercase">
              Persona {currentPersona} de {solicitud.cantidad_personas}
            </span>
          )}
        </div>
        {screen === "form" && (
          <>
            <div className="w-full h-1 bg-[#e8e8e4] rounded-full">
              <div
                className="h-1 bg-[#0a0a0a] rounded-full transition-all duration-500"
                style={{ width: `${progressPct + (stepPct / solicitud.cantidad_personas)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-[#a3a3a3]">{STEP_LABELS[currentStep]}</span>
              <span className="text-[10px] text-[#a3a3a3]">
                Paso {stepIndex + 1} de {FORM_STEPS.length}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ─ Pantalla bienvenida ────────────────────────────────────
  if (screen === "welcome") {
    return (
      <div className="min-h-screen bg-[#f7f7f6] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <div className="bg-white border border-[#e8e8e4] p-8 text-center">
            <div className="mb-6">
              <div className="relative h-12 w-40 mx-auto mb-4">
                <Image src="/logo-header.png" alt="Nivel Propiedades" fill className="object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-[#0a0a0a] mb-2" style={{ letterSpacing: "-0.03em" }}>
                Ficha de Datos Personales
              </h1>
              <p className="text-[13px] text-[#6b6b6b] font-medium">
                {solicitud.direccion}
              </p>
            </div>

            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 text-left rounded-sm">
              <p className="text-[13px] text-amber-900 font-semibold mb-2">Importante:</p>
              <ul className="text-[12px] text-amber-800 space-y-1 list-disc list-inside">
                <li>Tenga a mano el DNI (frente y dorso) de todas las personas.</li>
                <li>La carga demora aproximadamente entre 3 y 5 minutos por persona.</li>
                <li>Los datos son exclusivos para gestión inmobiliaria.</li>
              </ul>
            </div>

            {solicitud.cantidad_personas > 1 && (
              <div className="mb-6 text-[12px] text-[#6b6b6b]">
                Esta solicitud incluye{" "}
                <strong className="text-[#0a0a0a]">{solicitud.cantidad_personas} personas</strong>.
                Completará una ficha por cada una.
              </div>
            )}

            <button
              onClick={() => setScreen("form")}
              className="w-full h-12 bg-[#0a0a0a] text-white font-bold text-[13px] tracking-[0.05em] uppercase hover:bg-[#1a1a1a] transition-colors"
            >
              Comenzar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─ Pantalla declaración final ─────────────────────────────
  if (screen === "declaration") {
    return (
      <div className="min-h-screen bg-[#f7f7f6]">
        <Header />
        <div className="max-w-lg mx-auto px-5 py-8">
          <h2 className="text-xl font-bold text-[#0a0a0a] mb-1" style={{ letterSpacing: "-0.03em" }}>
            Declaración final
          </h2>
          <p className="text-[13px] text-[#6b6b6b] mb-6">
            Revisá el resumen antes de enviar.
          </p>

          {Object.values(fichas)
            .sort((a, b) => a.numero_persona - b.numero_persona)
            .map((f) => (
              <div key={f.numero_persona} className="bg-white border border-[#e8e8e4] p-4 mb-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check size={15} className="text-green-700" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0a0a0a]">
                    {`${f.nombre} ${f.apellido}`.trim() || `Persona ${f.numero_persona}`}
                  </p>
                  <p className="text-[11px] text-[#6b6b6b]">DNI {f.dni}</p>
                </div>
              </div>
            ))}

          <div className="mt-6 mb-6">
            <label className="flex gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={declaration}
                onChange={(e) => setDeclaration(e.target.checked)}
                className="w-5 h-5 flex-shrink-0 mt-0.5 accent-[#0a0a0a]"
              />
              <span className="text-[13px] text-[#0a0a0a]">
                Declaro que los datos ingresados son correctos y los presento a efectos de la operación inmobiliaria.
              </span>
            </label>
          </div>

          {submitError && (
            <p className="mb-4 text-[12px] text-red-600 font-medium">{submitError}</p>
          )}

          <button
            onClick={handleFinalizar}
            disabled={!declaration || generatingPdf}
            className="w-full h-12 bg-[#0a0a0a] text-white font-bold text-[13px] tracking-[0.05em] uppercase hover:bg-[#1a1a1a] transition-colors disabled:opacity-40"
          >
            {generatingPdf ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Procesando…
              </span>
            ) : (
              "Finalizar solicitud"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─ Formulario por paso ────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f7f6]">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">
        {/* Título del paso */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-[#0a0a0a]" style={{ letterSpacing: "-0.03em" }}>
            {STEP_LABELS[currentStep]}
          </h2>
          {solicitud.cantidad_personas > 1 && (
            <p className="text-[12px] text-[#6b6b6b] mt-1">
              Persona {currentPersona} · {currentFicha.nombre || `Sin nombre aún`}
            </p>
          )}
        </div>

        {/* Contenido del paso */}
        {currentStep === "personal" && <StepPersonal ficha={currentFicha} onChange={updateFicha} />}
        {currentStep === "domicilio" && <StepDomicilio ficha={currentFicha} onChange={updateFicha} />}
        {currentStep === "laboral" && <StepLaboral ficha={currentFicha} onChange={updateFicha} />}
        {currentStep === "habitacional" && <StepHabitacional ficha={currentFicha} onChange={updateFicha} />}
        {currentStep === "documentacion" && (
          <StepDocumentacion ficha={currentFicha} onUpload={handleDniUpload} uploading={dniUploading} />
        )}
        {currentStep === "revision" && <StepRevision ficha={currentFicha} />}

        {/* Error */}
        {submitError && (
          <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 text-[12px] text-red-700 font-medium">
            {submitError}
          </div>
        )}
      </div>

      {/* Barra inferior fija */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8e8e4] z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === "personal" && currentPersona === 1}
            className="flex items-center gap-1.5 h-11 px-4 border border-[#e8e8e4] text-[12px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={15} />
            Anterior
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 h-11 bg-[#0a0a0a] text-white text-[12px] font-bold tracking-[0.05em] uppercase hover:bg-[#1a1a1a] transition-colors disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Guardando…</>
            ) : currentStep === "revision" ? (
              <><Check size={14} /> {currentPersona < solicitud.cantidad_personas ? "Confirmar y continuar" : "Confirmar y enviar"}</>
            ) : (
              <>Siguiente <ChevronRight size={15} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
