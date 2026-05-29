"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────
interface AdminProperty {
  id?: number | string;
  title: string;
  operation: string;
  type: string;
  location: string;
  zone: string;
  address: string;
  rooms: number;
  price: string;
  expenses: string;
  meters: string;
  bathrooms: string;
  garage: string;
  highlight: string;
  details: string[];
  featured: boolean;
  publish_status: string;
  image: string;
  images: string[];
  description: string;
  keywords: string;
}

const EMPTY_PROPERTY: AdminProperty = {
  title: "",
  operation: "venta",
  type: "Departamento",
  location: "Ramos Mejía",
  zone: "",
  address: "",
  rooms: 0,
  price: "",
  expenses: "",
  meters: "",
  bathrooms: "",
  garage: "",
  highlight: "",
  details: [],
  featured: false,
  publish_status: "Publicada",
  image: "",
  images: [],
  description: "",
  keywords: "",
};

const BUCKET = "property-images";
const SESSION_DURATION = 60 * 60 * 1000;
const AUTH_KEY = "nivel_supabase_admin_last_activity";
const LOCATIONS = ["Ramos Mejía", "Haedo", "Villa Sarmiento", "Ciudadela", "Villa Luzuriaga", "Morón"];
const TYPES = ["Departamento", "Casa", "PH", "Lote", "Terreno", "Local", "Oficina", "Cochera", "Galpon"];

// ── Helpers ──────────────────────────────────────────────────────────────
function formatThousands(v: string): string {
  const digits = String(v || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function slugify(t: string): string {
  return String(t || "propiedad")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function mapRow(r: Record<string, unknown>): AdminProperty {
  return {
    id: r.id as number,
    title: (r.title as string) || "",
    operation: (r.operation as string) || "venta",
    type: (r.type as string) || "Departamento",
    location: (r.location as string) || "",
    zone: (r.zone as string) || "",
    address: (r.address as string) || "",
    rooms: (r.rooms as number) || 0,
    price: (r.price as string) || "",
    expenses: (r.expenses as string) || "",
    meters: (r.meters as string) || "",
    bathrooms: (r.bathrooms as string) || "",
    garage: (r.garage as string) || "",
    highlight: (r.highlight as string) || "",
    details: (r.details as string[]) || [],
    featured: Boolean(r.featured),
    publish_status: (r.publish_status as string) || "Publicada",
    image: (r.image as string) || "",
    images: (r.images as string[]) || [],
    description: (r.description as string) || "",
    keywords: (r.keywords as string) || "",
  };
}

// ── Toast ─────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({ msg: "", visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((msg: string) => {
    setToast({ msg, visible: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }, []);

  return { toast, show };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminPage() {
  const [screen, setScreen] = useState<"loading" | "login" | "app">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [tab, setTab] = useState<"list" | "form">("list");
  const [form, setForm] = useState<AdminProperty>(EMPTY_PROPERTY);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { toast, show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Session ──────────────────────────────────────────────────────────────
  const refreshActivity = () => localStorage.setItem(AUTH_KEY, String(Date.now()));
  const isSessionValid = () => {
    const last = Number(localStorage.getItem(AUTH_KEY) || 0);
    return last && Date.now() - last < SESSION_DURATION;
  };

  const logout = useCallback(async (msg = "") => {
    localStorage.removeItem(AUTH_KEY);
    await supabase.auth.signOut();
    setScreen("login");
    if (msg) setTimeout(() => show(msg), 100);
  }, [show]);

  // Check session on mount
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || !isSessionValid()) {
        setScreen("login");
        return;
      }
      refreshActivity();
      setScreen("app");
      loadProperties();
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Inactivity check
  useEffect(() => {
    if (screen !== "app") return;
    const interval = setInterval(() => {
      if (!isSessionValid()) logout("Sesión cerrada por inactividad");
    }, 60_000);
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    const refresh = () => { if (screen === "app") refreshActivity(); };
    events.forEach((e) => document.addEventListener(e, refresh, { passive: true }));
    return () => {
      clearInterval(interval);
      events.forEach((e) => document.removeEventListener(e, refresh));
    };
  }, [screen, logout]);

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadProperties = async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { show("Error al cargar"); return; }
    setProperties((data || []).map((r) => mapRow(r as Record<string, unknown>)));
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setScreen("loading");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setScreen("login");
      setLoginError(true);
      return;
    }
    refreshActivity();
    setScreen("app");
    setTab("list");
    show("Acceso correcto");
    await loadProperties();
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const uploadImages = async (files: File[], title: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() || "jpg";
      const path = `properties/${Date.now()}-${slugify(title)}-${i + 1}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw new Error("No se pudo subir imagen");
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 30);
    setPendingFiles(files);
    setPreviewImages(files.map((f) => URL.createObjectURL(f)));
    show(`${files.length} foto${files.length !== 1 ? "s" : ""} seleccionada${files.length !== 1 ? "s" : ""}`);
  };

  const removePreviewImage = (i: number) => {
    setPreviewImages((prev) => prev.filter((_, idx) => idx !== i));
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { show("Falta el título"); return; }
    setSaving(true);
    try {
      let finalImages = form.images;
      if (pendingFiles.length > 0) {
        setUploading(true);
        finalImages = await uploadImages(pendingFiles, form.title);
        setUploading(false);
      }

      const payload = {
        title: form.title,
        operation: form.operation,
        type: form.type,
        location: form.location,
        zone: form.zone || form.location,
        address: form.address,
        rooms: form.rooms,
        price: form.price,
        expenses: form.expenses,
        meters: form.meters,
        bathrooms: form.bathrooms,
        garage: form.garage,
        highlight: form.highlight,
        details: [
          form.rooms ? `${form.rooms} ambiente${form.rooms === 1 ? "" : "s"}` : "",
          form.meters,
          form.highlight,
        ].filter(Boolean),
        featured: form.featured,
        publish_status: form.publish_status,
        image: finalImages[0] || "",
        images: finalImages,
        description: form.description,
        keywords: `${form.title} ${form.operation} ${form.type} ${form.location} ${form.zone}`.toLowerCase(),
      };

      if (editingId) {
        const { error } = await supabase.from("properties").update(payload).eq("id", editingId);
        if (error) throw error;
        show("Propiedad actualizada");
      } else {
        const { error } = await supabase.from("properties").insert(payload);
        if (error) throw error;
        show("Propiedad guardada");
      }

      await loadProperties();
      setTab("list");
      setForm(EMPTY_PROPERTY);
      setEditingId(null);
      setPreviewImages([]);
      setPendingFiles([]);
    } catch (err) {
      show(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const startEdit = (p: AdminProperty) => {
    setForm(p);
    setEditingId(p.id ?? null);
    setPreviewImages(p.images || []);
    setPendingFiles([]);
    setTab("form");
  };

  const startNew = () => {
    setForm(EMPTY_PROPERTY);
    setEditingId(null);
    setPreviewImages([]);
    setPendingFiles([]);
    setTab("form");
  };

  const handleDelete = async (id: string | number) => {
    const p = properties.find((x) => String(x.id) === String(id));
    if (!p || !confirm(`¿Eliminar "${p.title}"?`)) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) { show("No se pudo eliminar"); return; }
    await loadProperties();
    show("Propiedad eliminada");
  };

  const handleToggleStatus = async (id: string | number) => {
    const p = properties.find((x) => String(x.id) === String(id));
    if (!p) return;
    const next = p.publish_status === "Publicada" ? "Pausada" : "Publicada";
    const { error } = await supabase.from("properties").update({ publish_status: next }).eq("id", id);
    if (error) { show("No se pudo cambiar estado"); return; }
    await loadProperties();
    show(next === "Publicada" ? "Propiedad publicada" : "Propiedad oculta");
  };

  const handleDuplicate = async (id: string | number) => {
    const p = properties.find((x) => String(x.id) === String(id));
    if (!p) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = p;
    const { error } = await supabase.from("properties").insert({ ...rest, title: `${p.title} copia`, featured: false, publish_status: "Borrador" });
    if (error) { show("No se pudo duplicar"); return; }
    await loadProperties();
    show("Propiedad duplicada");
  };

  const quickPrice = async (id: string | number) => {
    const p = properties.find((x) => String(x.id) === String(id));
    if (!p) return;
    const next = prompt("Nuevo precio (ej: USD 145000 o $ 480000):", p.price);
    if (next === null) return;
    const clean = next.trim();
    if (!clean) { show("Precio vacío"); return; }
    let formatted = clean;
    if (clean.startsWith("USD")) formatted = `USD ${formatThousands(clean)}`;
    else if (clean.startsWith("$")) formatted = `$ ${formatThousands(clean)}`;
    else formatted = `${p.price?.startsWith("$") ? "$" : "USD"} ${formatThousands(clean)}`;
    const { error } = await supabase.from("properties").update({ price: formatted }).eq("id", id);
    if (error) { show("No se pudo actualizar precio"); return; }
    await loadProperties();
    show("Precio actualizado");
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = properties.filter((p) => {
    const t = `${p.title} ${p.type} ${p.location} ${p.zone} ${p.price}`.toLowerCase();
    return !search || t.includes(search.toLowerCase());
  });

  const stats = {
    total: properties.length,
    published: properties.filter((p) => p.publish_status === "Publicada").length,
    sale: properties.filter((p) => p.operation === "venta").length,
    rental: properties.filter((p) => p.operation === "alquiler").length,
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Render: loading
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f7f6]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6b6b6b] text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Render: login
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f7f6] p-5">
        <div className="w-full max-w-sm bg-white border border-[#e5e5e5] p-8">
          <div className="text-center mb-8">
            <Image src="/logo-header.png" alt="Nivel Propiedades" width={120} height={36} className="h-9 w-auto mx-auto mb-6 object-contain" />
            <h1 className="font-bold text-xl text-[#0a0a0a]" style={{ letterSpacing: "-0.03em" }}>
              Administración
            </h1>
          </div>

          <form onSubmit={handleLogin} className="grid gap-4">
            {loginError && (
              <p className="text-[11px] text-red-600 font-semibold text-center bg-red-50 border border-red-100 px-3 py-2">
                Email o contraseña incorrectos.
              </p>
            )}
            <div>
              <label className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 border border-[#e5e5e5] px-3 text-sm focus:border-[#0a0a0a] focus:outline-none"
                placeholder="admin@email.com"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] block mb-1.5">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 border border-[#e5e5e5] px-3 text-sm focus:border-[#0a0a0a] focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="h-11 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#1a1a1a] transition-colors mt-2"
            >
              Ingresar
            </button>
          </form>
        </div>

        {toast.visible && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-sm px-5 py-3 font-medium">
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Render: admin app
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#f7f7f6] pb-20">
      {/* Admin header */}
      <div className="bg-white border-b border-[#e5e5e5] sticky top-[72px] z-20">
        <div className="max-w-[1300px] mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#0a0a0a]">
              Nivel Admin
            </span>
            <span className="text-[#e5e5e5]">·</span>
            <span className="text-[11px] text-[#a3a3a3]">{stats.total} propiedades</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-[11px] text-[#a3a3a3]">
              <span>{stats.published} publicadas</span>
              <span>{stats.sale} ventas</span>
              <span>{stats.rental} alquileres</span>
            </div>
            <button
              onClick={() => logout("Sesión cerrada")}
              className="h-7 px-4 border border-[#e5e5e5] text-[11px] text-[#6b6b6b] font-semibold tracking-wide hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1300px] mx-auto px-5 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[#e5e5e5]">
          <button
            onClick={() => setTab("list")}
            className={`h-10 px-5 text-[11px] font-semibold tracking-[0.08em] uppercase border-b-2 transition-colors ${
              tab === "list" ? "border-[#0a0a0a] text-[#0a0a0a]" : "border-transparent text-[#a3a3a3] hover:text-[#6b6b6b]"
            }`}
          >
            Propiedades
          </button>
          <button
            onClick={startNew}
            className={`h-10 px-5 text-[11px] font-semibold tracking-[0.08em] uppercase border-b-2 transition-colors ${
              tab === "form" ? "border-[#0a0a0a] text-[#0a0a0a]" : "border-transparent text-[#a3a3a3] hover:text-[#6b6b6b]"
            }`}
          >
            {editingId ? "Editar propiedad" : "Nueva propiedad"}
          </button>
        </div>

        {/* ── LIST TAB ──────────────────────────────────── */}
        {tab === "list" && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <input
                type="text"
                placeholder="Buscar propiedad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full max-w-sm border border-[#e5e5e5] bg-white px-4 text-sm focus:border-[#0a0a0a] focus:outline-none"
              />
              <button
                onClick={startNew}
                className="h-10 px-5 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.08em] uppercase hover:bg-[#1a1a1a] transition-colors flex-shrink-0"
              >
                + Nueva
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-[#e5e5e5]">
                <p className="text-[#a3a3a3] text-sm">No hay propiedades para mostrar.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((p) => (
                  <div key={String(p.id)} className="bg-white border border-[#e5e5e5] overflow-hidden">
                    <div className="flex gap-4 p-4">
                      {/* Thumbnail */}
                      <div className="relative w-20 h-16 flex-shrink-0 bg-[#f7f7f6] overflow-hidden">
                        {(p.image || p.images?.[0]) && (
                          <Image
                            src={p.image || p.images[0]}
                            alt={p.title}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-[#0a0a0a] text-sm leading-tight truncate">{p.title}</h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 border ${p.operation === "alquiler" ? "border-[#e5e5e5] text-[#6b6b6b]" : "bg-[#0a0a0a] text-white border-[#0a0a0a]"}`}>
                              {p.operation === "alquiler" ? "Alquiler" : "Venta"}
                            </span>
                            <span className={`text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 border ${
                              p.publish_status === "Publicada" ? "border-green-500 text-green-700" :
                              p.publish_status === "Pausada" ? "border-amber-500 text-amber-700" :
                              "border-[#e5e5e5] text-[#a3a3a3]"
                            }`}>
                              {p.publish_status}
                            </span>
                          </div>
                        </div>
                        <p className="text-[12px] text-[#6b6b6b] mb-2 truncate">
                          {p.zone || p.location} · {p.price || "-"} · {p.type}
                          {p.featured && <span className="ml-2 text-[#0a0a0a] font-bold">★</span>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => startEdit(p)} className="h-7 px-3 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
                            Editar
                          </button>
                          <button onClick={() => quickPrice(p.id!)} className="h-7 px-3 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
                            Precio
                          </button>
                          <button onClick={() => handleToggleStatus(p.id!)} className="h-7 px-3 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
                            {p.publish_status === "Publicada" ? "Ocultar" : "Publicar"}
                          </button>
                          <button onClick={() => handleDuplicate(p.id!)} className="h-7 px-3 border border-[#e5e5e5] text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
                            Duplicar
                          </button>
                          <button onClick={() => handleDelete(p.id!)} className="h-7 px-3 border border-red-100 text-[10px] font-semibold uppercase tracking-wide text-red-600 hover:border-red-500 hover:bg-red-50 transition-colors">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FORM TAB ──────────────────────────────────── */}
        {tab === "form" && (
          <form onSubmit={handleSave} className="grid gap-6 max-w-3xl">
            <div>
              <h2 className="font-bold text-xl text-[#0a0a0a] mb-1" style={{ letterSpacing: "-0.03em" }}>
                {editingId ? "Editar propiedad" : "Nueva propiedad"}
              </h2>
              <p className="text-[12px] text-[#a3a3a3]">
                {editingId ? `ID: ${editingId}` : "Completá los datos principales"}
              </p>
            </div>

            {/* Basic info */}
            <div className="bg-white border border-[#e5e5e5] p-6 grid gap-4">
              <h3 className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">Datos principales</h3>

              <div>
                <label className="label-admin">Título *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="input-admin"
                  placeholder="Ej: Departamento con balcón"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-admin">Operación</label>
                  <select
                    value={form.operation}
                    onChange={(e) => setForm((f) => ({ ...f, operation: e.target.value }))}
                    className="input-admin"
                  >
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                  </select>
                </div>
                <div>
                  <label className="label-admin">Tipo</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="input-admin"
                  >
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-admin">Localidad</label>
                  <select
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="input-admin"
                  >
                    {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-admin">Zona / barrio</label>
                  <input
                    type="text"
                    value={form.zone}
                    onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                    className="input-admin"
                    placeholder="Ramos Mejía Centro"
                  />
                </div>
              </div>

              <div>
                <label className="label-admin">Dirección completa</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="input-admin"
                  placeholder="Av. de Mayo 325, Ramos Mejía, Buenos Aires, Argentina"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white border border-[#e5e5e5] p-6 grid gap-4">
              <h3 className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">Precio y detalles</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-admin">Precio</label>
                  <input
                    type="text"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="input-admin"
                    placeholder="USD 145.000 o $ 480.000"
                  />
                </div>
                <div>
                  <label className="label-admin">Expensas</label>
                  <input
                    type="text"
                    value={form.expenses}
                    onChange={(e) => setForm((f) => ({ ...f, expenses: e.target.value }))}
                    className="input-admin"
                    placeholder="$ 85.000 o Sin expensas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-admin">Ambientes</label>
                  <input
                    type="number"
                    min={0}
                    value={form.rooms || ""}
                    onChange={(e) => setForm((f) => ({ ...f, rooms: Number(e.target.value) }))}
                    className="input-admin"
                    placeholder="3"
                  />
                </div>
                <div>
                  <label className="label-admin">Superficie</label>
                  <input
                    type="text"
                    value={form.meters}
                    onChange={(e) => setForm((f) => ({ ...f, meters: e.target.value }))}
                    className="input-admin"
                    placeholder="78 m²"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-admin">Baños</label>
                  <input
                    type="text"
                    value={form.bathrooms}
                    onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                    className="input-admin"
                    placeholder="1 baño"
                  />
                </div>
                <div>
                  <label className="label-admin">Cochera</label>
                  <input
                    type="text"
                    value={form.garage}
                    onChange={(e) => setForm((f) => ({ ...f, garage: e.target.value }))}
                    className="input-admin"
                    placeholder="1 cochera / No posee"
                  />
                </div>
              </div>

              <div>
                <label className="label-admin">Destaque</label>
                <input
                  type="text"
                  value={form.highlight}
                  onChange={(e) => setForm((f) => ({ ...f, highlight: e.target.value }))}
                  className="input-admin"
                  placeholder="Balcón y cochera"
                />
              </div>
            </div>

            {/* Status + featured */}
            <div className="bg-white border border-[#e5e5e5] p-6 grid gap-4">
              <h3 className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">Publicación</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-admin">Estado</label>
                  <select
                    value={form.publish_status}
                    onChange={(e) => setForm((f) => ({ ...f, publish_status: e.target.value }))}
                    className="input-admin"
                  >
                    <option value="Publicada">Publicada</option>
                    <option value="Pausada">Pausada</option>
                    <option value="Borrador">Borrador</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-[#0a0a0a]">Propiedad destacada</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white border border-[#e5e5e5] p-6 grid gap-4">
              <h3 className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">Fotos</h3>

              <div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-10 px-5 border border-dashed border-[#c0c0c0] text-[11px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
                >
                  Subir fotos
                </button>
                <p className="text-[11px] text-[#a3a3a3] mt-1">Máx. 30 fotos. La primera será la portada.</p>
              </div>

              {previewImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previewImages.map((src, i) => (
                    <div key={i} className="relative group">
                      <div className="relative w-20 h-16 bg-[#f7f7f6] overflow-hidden border border-[#e5e5e5]">
                        <Image src={src} alt={`Foto ${i + 1}`} fill className="object-cover" sizes="80px" />
                        {i === 0 && (
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold bg-[#0a0a0a] text-white py-0.5">
                            Portada
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removePreviewImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#0a0a0a] text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Also allow URL for image if no file */}
              {pendingFiles.length === 0 && (
                <div>
                  <label className="label-admin">URL imagen principal (alternativa)</label>
                  <input
                    type="url"
                    value={form.image}
                    onChange={(e) => setForm((f) => ({ ...f, image: e.target.value, images: [e.target.value, ...f.images.slice(1)] }))}
                    className="input-admin"
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white border border-[#e5e5e5] p-6 grid gap-4">
              <h3 className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3]">Descripción</h3>
              <textarea
                rows={6}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input-admin resize-none"
                placeholder="Descripción de la propiedad..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="h-11 px-8 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#1a1a1a] transition-colors disabled:opacity-60"
              >
                {uploading ? "Subiendo fotos..." : saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar propiedad"}
              </button>
              <button
                type="button"
                onClick={() => { setTab("list"); setForm(EMPTY_PROPERTY); setEditingId(null); setPreviewImages([]); setPendingFiles([]); }}
                className="h-11 px-6 border border-[#e5e5e5] text-[11px] font-semibold uppercase tracking-wide text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Toast */}
      {toast.visible && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#0a0a0a] text-white text-sm px-5 py-3 font-medium z-50 shadow-lg">
          {toast.msg}
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
          appearance: none;
        }
        .input-admin:focus {
          border-color: #0a0a0a;
        }
        textarea.input-admin {
          height: auto;
          padding: 10px 12px;
        }
      `}</style>
    </div>
  );
}
