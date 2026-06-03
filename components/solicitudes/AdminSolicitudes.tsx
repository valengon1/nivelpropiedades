"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Copy, RefreshCw, Trash2, Download, FileText,
  ExternalLink, X, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp,
  Users, Clock, CheckCircle, XCircle,
} from "lucide-react";
import type { Solicitud, FichaPersona } from "@/types/solicitud";
import { ESTADO_CIVIL_LABELS } from "@/types/solicitud";
import {
  getSolicitudes, createSolicitud, deleteSolicitud,
  regenerarTokenSolicitud, getFichasPersonas,
  buildFichaUrl, formatFecha, isExpired,
} from "@/lib/solicitudes";
import { generateSolicitudPdf } from "@/lib/pdfGenerator";

// ── Toast interno ─────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const show = useCallback((m: string) => {
    setMsg(m); setVisible(true);
    setTimeout(() => setVisible(false), 2800);
  }, []);
  return { msg, visible, show };
}

// ── Formato de fecha relativa ─────────────────────────────────

function diasRestantes(iso: string): string {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (d < 0) return "Vencida";
  if (d === 0) return "Vence hoy";
  return `Vence en ${d} día${d !== 1 ? "s" : ""}`;
}

// ── Badge de estado ───────────────────────────────────────────

function EstadoBadge({ estado, vencimiento }: { estado: string; vencimiento: string }) {
  const expired = estado === "vencida" || (estado === "pendiente" && new Date(vencimiento) < new Date());
  if (estado === "completada") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-0.5 bg-green-100 text-green-800 border border-green-300">
        <CheckCircle size={11} /> Completada
      </span>
    );
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-0.5 bg-red-50 text-red-700 border border-red-300">
        <XCircle size={11} /> Vencida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-300">
      <Clock size={11} /> Pendiente
    </span>
  );
}

// ── Modal crear solicitud ─────────────────────────────────────

function ModalCrear({ onClose, onCreated }: { onClose: () => void; onCreated: (sol: Solicitud) => void }) {
  const [direccion, setDireccion] = useState("");
  const [nombreRef, setNombreRef] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!direccion.trim()) { setErr("La dirección es obligatoria"); return; }
    setSaving(true);
    try {
      const sol = await createSolicitud(direccion.trim(), cantidad, nombreRef.trim() || undefined);
      onCreated(sol);
    } catch {
      setErr("No se pudo crear la solicitud. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5]">
          <h3 className="font-bold text-[#0a0a0a] text-[15px] tracking-[-0.01em]">Nueva solicitud</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

          {/* Dirección */}
          <div className="flex flex-col gap-1.5">
            <span className="block text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">
              Dirección de la propiedad
            </span>
            <input
              required autoFocus type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ingresá aquí la dirección"
              className="w-full h-10 border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none transition-colors"
            />
          </div>

          {/* Nombre de referencia */}
          <div className="flex flex-col gap-1.5">
            <span className="block text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">
              Nombre de referencia
            </span>
            <input
              type="text"
              value={nombreRef}
              onChange={(e) => setNombreRef(e.target.value)}
              placeholder="Ingresá aquí el nombre"
              className="w-full h-10 border border-[#e5e5e5] bg-white px-3 text-[14px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none transition-colors"
            />
          </div>

          {/* Cantidad de personas */}
          <div className="flex flex-col gap-2">
            <span className="block text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">
              Cantidad de personas
            </span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCantidad(n)}
                  className={`flex-1 h-10 border text-[13px] font-bold transition-colors ${
                    cantidad === n
                      ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                      : "border-[#e5e5e5] text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {err && <p className="text-[12px] text-red-600 font-medium">{err}</p>}

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 border border-[#e5e5e5] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors uppercase tracking-wide">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-10 bg-[#0a0a0a] text-white text-[11px] font-bold uppercase tracking-wide hover:bg-[#1a1a1a] transition-colors disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Generar solicitud"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal confirmación eliminar ───────────────────────────────

function ModalEliminar({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-600" />
        </div>
        <h3 className="font-bold text-[#0a0a0a] text-[15px] mb-2">¿Eliminar esta solicitud?</h3>
        <p className="text-[12px] text-[#6b6b6b] mb-6">Esta acción no puede deshacerse. Se eliminarán todos los datos, documentos e imágenes asociados.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 h-10 border border-[#e5e5e5] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] transition-colors uppercase tracking-wide">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 h-10 bg-red-600 text-white text-[11px] font-bold uppercase tracking-wide hover:bg-red-700 transition-colors disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal link generado ───────────────────────────────────────

function ModalLink({ sol, onClose }: { sol: Solicitud; onClose: () => void }) {
  const url = buildFichaUrl(sol.id, sol.token);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-5"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-[480px] overflow-hidden shadow-2xl sm:rounded-sm"
        onClick={(e) => e.stopPropagation()}>
        {/* Header verde */}
        <div className="relative bg-green-700 px-7 pt-8 pb-7">
          <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center mb-5">
            <Check size={22} className="text-white" />
          </div>
          <h3 className="text-white font-bold text-[22px]" style={{ letterSpacing: "-0.03em" }}>
            Solicitud #{sol.id} creada
          </h3>
          <p className="text-white/70 text-[13px] mt-1">
            Enviá el enlace al cliente para que complete sus datos.
          </p>
          <button onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white/70 hover:bg-white/30 hover:text-white transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="px-7 py-6 grid gap-5">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Solicitud", value: `#${sol.id}` },
              { label: "Personas", value: `${sol.cantidad_personas}` },
              { label: "Vence", value: formatFecha(sol.fecha_vencimiento) },
            ].map((i) => (
              <div key={i.label} className="bg-[#f7f7f6] border border-[#e5e5e5] px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] mb-1">{i.label}</p>
                <p className="text-[13px] font-bold text-[#0a0a0a]">{i.value}</p>
              </div>
            ))}
          </div>

          {/* Link */}
          <div>
            <label className="label-admin">Enlace para el cliente</label>
            <div className="flex gap-2">
              <input readOnly value={url}
                className="input-admin !text-[12px] flex-1 cursor-text select-all"
                onClick={(e) => (e.target as HTMLInputElement).select()} />
              <button onClick={copy}
                className={`h-10 px-4 border text-[11px] font-bold uppercase tracking-wide transition-all flex-shrink-0 flex items-center gap-1.5 ${
                  copied
                    ? "bg-green-700 text-white border-green-700"
                    : "border-[#e5e5e5] text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
                }`}>
                {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-[#a3a3a3]">
            El enlace expira automáticamente el {formatFecha(sol.fecha_vencimiento)}. Podés regenerarlo desde el panel si vence.
          </p>

          <button onClick={onClose}
            className="h-11 bg-[#0a0a0a] text-white text-[11px] font-bold uppercase tracking-[0.07em] hover:bg-[#1a1a1a] transition-colors">
            Listo, cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detalle de solicitud (panel expandible) ───────────────────

function SolicitudDetalle({ sol }: { sol: Solicitud }) {
  const [fichas, setFichas] = useState<FichaPersona[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getFichasPersonas(sol.id);
        setFichas(data.sort((a, b) => a.numero_persona - b.numero_persona));
      } catch {}
      setLoading(false);
    };
    load();
  }, [sol.id]);

  const downloadPdf = async () => {
    if (sol.pdf_url) {
      window.open(sol.pdf_url, "_blank");
      return;
    }
    if (!fichas || fichas.length === 0) return;
    setGeneratingPdf(true);
    try {
      const blob = await generateSolicitudPdf(sol, fichas);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Solicitud-${sol.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setGeneratingPdf(false);
  };

  const downloadZip = async () => {
    if (!fichas || fichas.length === 0) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    for (const f of fichas) {
      const nombre = `${f.nombre}-${f.apellido}`.replace(/\s+/g, "_");
      if (f.dni_frente_url) {
        const res = await fetch(f.dni_frente_url);
        if (res.ok) zip.file(`${nombre}-DNI-frente.jpg`, await res.arrayBuffer());
      }
      if (f.dni_dorso_url) {
        const res = await fetch(f.dni_dorso_url);
        if (res.ok) zip.file(`${nombre}-DNI-dorso.jpg`, await res.arrayBuffer());
      }
    }

    if (sol.pdf_url) {
      const res = await fetch(sol.pdf_url);
      if (res.ok) zip.file(`Solicitud-${sol.id}.pdf`, await res.arrayBuffer());
    } else {
      const pdfBlob = await generateSolicitudPdf(sol, fichas);
      zip.file(`Solicitud-${sol.id}.pdf`, pdfBlob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Solicitud-${sol.id}-completa.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="border-t border-[#e5e5e5] p-6 flex items-center gap-2 text-[12px] text-[#6b6b6b]">
        <Loader2 size={14} className="animate-spin" /> Cargando fichas…
      </div>
    );
  }

  return (
    <div className="border-t border-[#e5e5e5] bg-[#fafaf8]">
      <div className="p-5">
        <div className="flex flex-wrap gap-2 mb-5">
          {sol.pdf_url && (
            <a href={sol.pdf_url} target="_blank" rel="noopener noreferrer"
              className="h-8 px-4 flex items-center gap-2 bg-[#0a0a0a] text-white text-[10px] font-bold uppercase tracking-wide hover:bg-[#1a1a1a] transition-colors">
              <FileText size={12} /> Ver PDF
            </a>
          )}
          <button onClick={downloadPdf} disabled={generatingPdf}
            className="h-8 px-4 flex items-center gap-2 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors disabled:opacity-40">
            {generatingPdf ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Descargar PDF
          </button>
          {fichas && fichas.length > 0 && (
            <button onClick={downloadZip}
              className="h-8 px-4 flex items-center gap-2 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
              <Download size={12} /> Descargar ZIP
            </button>
          )}
        </div>

        {fichas && fichas.length === 0 && (
          <p className="text-[12px] text-[#a3a3a3]">No hay fichas completadas aún.</p>
        )}

        {fichas && fichas.map((f) => (
          <div key={f.id} className="bg-white border border-[#e5e5e5] mb-4 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e5e5] bg-[#f7f7f6] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#0a0a0a] tracking-[0.05em] uppercase">
                  Persona {f.numero_persona} — {`${f.nombre} ${f.apellido}`.trim() || "Sin nombre"}
                </span>
                {f.completada && (
                  <span className="ml-2 text-[10px] text-green-700 font-semibold">✓ Completa</span>
                )}
              </div>
              {f.dni && <span className="text-[11px] text-[#a3a3a3]">DNI {f.dni}</span>}
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
              {f.cuit_cuil && <div><span className="text-[#a3a3a3] block">CUIT/CUIL</span>{f.cuit_cuil}</div>}
              {f.fecha_nacimiento && <div><span className="text-[#a3a3a3] block">Nacimiento</span>{new Date(f.fecha_nacimiento + "T00:00:00").toLocaleDateString("es-AR")}</div>}
              {f.estado_civil && <div><span className="text-[#a3a3a3] block">Estado civil</span>{ESTADO_CIVIL_LABELS[f.estado_civil as keyof typeof ESTADO_CIVIL_LABELS] || f.estado_civil}</div>}
              {f.profesion && <div><span className="text-[#a3a3a3] block">Profesión</span>{f.profesion}</div>}
              {f.celular && <div><span className="text-[#a3a3a3] block">Celular</span>{f.celular}</div>}
              {f.email && <div><span className="text-[#a3a3a3] block">Email</span>{f.email}</div>}
              {f.dom_localidad && <div><span className="text-[#a3a3a3] block">Localidad</span>{f.dom_localidad}</div>}
              {f.empresa && <div><span className="text-[#a3a3a3] block">Empresa</span>{f.empresa}</div>}
            </div>
            {(f.dni_frente_url || f.dni_dorso_url) && (
              <div className="px-4 pb-4 flex gap-4">
                {f.dni_frente_url && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#a3a3a3] mb-1">DNI Frente</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.dni_frente_url} alt="DNI Frente" className="h-20 object-contain border border-[#e5e5e5]" />
                  </div>
                )}
                {f.dni_dorso_url && (
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#a3a3a3] mb-1">DNI Dorso</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.dni_dorso_url} alt="DNI Dorso" className="h-20 object-contain border border-[#e5e5e5]" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

export function AdminSolicitudes({ adminEmail }: { adminEmail?: string }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todas" | "pendiente" | "completada" | "vencida">("todas");
  const [showCrear, setShowCrear] = useState(false);
  const [showLink, setShowLink] = useState<Solicitud | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const { msg: toastMsg, visible: toastVisible, show: showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSolicitudes();
      setSolicitudes(data);
    } catch {
      showToast("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Estadísticas
  const stats = {
    total: solicitudes.length,
    completadas: solicitudes.filter((s) => s.estado === "completada").length,
    pendientes: solicitudes.filter((s) => s.estado === "pendiente" && !isExpired(s)).length,
    vencidas: solicitudes.filter((s) => isExpired(s)).length,
  };

  // Filtrar
  const filtered = solicitudes.filter((s) => {
    const matchSearch =
      !search ||
      String(s.id).includes(search) ||
      s.direccion.toLowerCase().includes(search.toLowerCase()) ||
      (s.nombre_ref || "").toLowerCase().includes(search.toLowerCase());

    const computedEstado = isExpired(s) ? "vencida" : s.estado;
    const matchFilter = filter === "todas" || computedEstado === filter;

    return matchSearch && matchFilter;
  });

  const handleCreated = (sol: Solicitud) => {
    setSolicitudes((prev) => [sol, ...prev]);
    setShowCrear(false);
    setShowLink(sol);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSolicitud(toDelete);
      setSolicitudes((prev) => prev.filter((s) => s.id !== toDelete));
      setExpanded(null);
      showToast("Solicitud eliminada");
    } catch {
      showToast("Error al eliminar");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const handleRegenerar = async (id: number) => {
    setRegenerating(id);
    try {
      const newToken = await regenerarTokenSolicitud(id);
      setSolicitudes((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                token: newToken,
                estado: "pendiente",
                fecha_vencimiento: new Date(Date.now() + 7 * 86400000).toISOString(),
              }
            : s
        )
      );
      showToast("Link regenerado correctamente");
    } catch {
      showToast("Error al regenerar el link");
    } finally {
      setRegenerating(null);
    }
  };

  const copyLink = (sol: Solicitud) => {
    const url = buildFichaUrl(sol.id, sol.token);
    navigator.clipboard.writeText(url).then(() => showToast("Link copiado al portapapeles"));
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total", value: stats.total,
            numColor: "text-[#0a0a0a]", accent: "border-l-[#0a0a0a]",
            bg: "bg-white", icon: <FileText size={15} className="text-[#0a0a0a]" />,
          },
          {
            label: "Completadas", value: stats.completadas,
            numColor: "text-green-700", accent: "border-l-green-500",
            bg: "bg-white", icon: <CheckCircle size={15} className="text-green-600" />,
          },
          {
            label: "Pendientes", value: stats.pendientes,
            numColor: "text-amber-700", accent: "border-l-amber-400",
            bg: "bg-white", icon: <Clock size={15} className="text-amber-500" />,
          },
          {
            label: "Vencidas", value: stats.vencidas,
            numColor: "text-red-700", accent: "border-l-red-500",
            bg: "bg-white", icon: <XCircle size={15} className="text-red-500" />,
          },
        ].map((s) => (
          <div key={s.label}
            className={`${s.bg} border border-[#e5e5e5] border-l-4 ${s.accent} px-5 py-4 flex items-center justify-between gap-3`}>
            <div>
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] mb-1">{s.label}</p>
              <p className={`text-[32px] font-bold leading-none ${s.numColor}`} style={{ letterSpacing: "-0.04em" }}>
                {s.value}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#f7f7f6] flex items-center justify-center flex-shrink-0">
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
          <input
            type="text"
            placeholder="Buscar por #, dirección o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 border border-[#e5e5e5] bg-white text-[13px] focus:border-[#0a0a0a] focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {(["todas", "completada", "pendiente", "vencida"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-10 px-4 text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                filter === f ? "bg-[#0a0a0a] text-white border-[#0a0a0a]" : "bg-white text-[#6b6b6b] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCrear(true)}
          className="h-10 px-5 bg-[#0a0a0a] text-white text-[11px] font-bold uppercase tracking-wide hover:bg-[#1a1a1a] transition-colors flex items-center gap-2 flex-shrink-0"
        >
          <Plus size={14} /> Generar nueva solicitud
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-[#6b6b6b]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Cargando solicitudes…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-[#e5e5e5] bg-white">
          <div className="w-14 h-14 bg-[#f7f7f6] rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-[#c0c0c0]" />
          </div>
          <p className="font-semibold text-[#0a0a0a] text-[14px] mb-1">
            {search || filter !== "todas" ? "Sin resultados" : "Aún no hay solicitudes"}
          </p>
          <p className="text-[#a3a3a3] text-[12px]">
            {search || filter !== "todas"
              ? "Probá cambiando los filtros o el texto de búsqueda."
              : "Generá la primera solicitud para empezar."}
          </p>
          {!search && filter === "todas" && (
            <button
              onClick={() => setShowCrear(true)}
              className="mt-5 h-10 px-6 bg-[#0a0a0a] text-white text-[11px] font-bold uppercase tracking-wide hover:bg-[#1a1a1a] transition-colors inline-flex items-center gap-2"
            >
              <Plus size={13} /> Generar primera solicitud
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((sol) => {
            const expired = isExpired(sol);
            const isOpen = expanded === sol.id;
            const link = buildFichaUrl(sol.id, sol.token);

            return (
              <div key={sol.id} className="bg-white border border-[#e5e5e5] overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[11px] font-bold text-[#a3a3a3]">#{sol.id}</span>
                        <EstadoBadge estado={sol.estado} vencimiento={sol.fecha_vencimiento} />
                        <span className="text-[10px] text-[#a3a3a3]">
                          <Users size={10} className="inline mr-0.5" />
                          {sol.cantidad_personas} persona{sol.cantidad_personas !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <h3 className="font-semibold text-[#0a0a0a] text-[14px] leading-tight truncate">
                        {sol.direccion}
                      </h3>
                      {sol.nombre_ref && (
                        <p className="text-[12px] text-[#6b6b6b] mt-0.5">{sol.nombre_ref}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#a3a3a3]">
                        <span>Creada {formatFecha(sol.created_at)}</span>
                        {sol.estado === "completada" && sol.fecha_completada && (
                          <span className="text-green-700 font-medium">Completada {formatFecha(sol.fecha_completada)}</span>
                        )}
                        {sol.estado === "pendiente" && !expired && (
                          <span className="text-amber-600 font-medium">{diasRestantes(sol.fecha_vencimiento)}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setExpanded(isOpen ? null : sol.id)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-[#e5e5e5] text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {sol.estado !== "completada" && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 px-3 flex items-center gap-1.5 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
                      >
                        <ExternalLink size={11} /> Ver link
                      </a>
                    )}
                    <button
                      onClick={() => copyLink(sol)}
                      className="h-7 px-3 flex items-center gap-1.5 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
                    >
                      <Copy size={11} /> Copiar link
                    </button>
                    {sol.estado !== "completada" && (
                      <button
                        onClick={() => handleRegenerar(sol.id)}
                        disabled={regenerating === sol.id}
                        className="h-7 px-3 flex items-center gap-1.5 border border-blue-100 text-[10px] font-semibold uppercase tracking-wide text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-40"
                      >
                        {regenerating === sol.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                        Regenerar link
                      </button>
                    )}
                    <button
                      onClick={() => setToDelete(sol.id)}
                      className="h-7 px-3 flex items-center gap-1.5 border border-red-100 text-[10px] font-semibold uppercase tracking-wide text-red-600 hover:border-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={11} /> Eliminar
                    </button>
                  </div>
                </div>

                {isOpen && <SolicitudDetalle sol={sol} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showCrear && <ModalCrear onClose={() => setShowCrear(false)} onCreated={handleCreated} />}
      {showLink && <ModalLink sol={showLink} onClose={() => setShowLink(null)} />}
      {toDelete && (
        <ModalEliminar
          onClose={() => setToDelete(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {/* Toast */}
      {toastVisible && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-[13px] px-5 py-3 font-medium z-[300] shadow-lg">
          {toastMsg}
        </div>
      )}

      <style jsx>{`
        .label-admin {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #a3a3a3;
          margin-bottom: 6px;
        }
        .input-admin {
          width: 100%;
          height: 40px;
          border: 1px solid #e5e5e5;
          background: white;
          padding: 0 12px;
          font-size: 14px;
          color: #0a0a0a;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-admin:focus {
          border-color: #0a0a0a;
        }
      `}</style>
    </div>
  );
}
