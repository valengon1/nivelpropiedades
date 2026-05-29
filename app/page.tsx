"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Search, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { formatMoney, buildWhatsappLink, matchesRooms } from "@/lib/utils";
import {
  type Property,
  type PropertyFilters,
  DEFAULT_PROPERTIES,
  mapDbRow,
} from "@/types/property";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyDetail } from "@/components/properties/PropertyDetail";
import { PropertySearch } from "@/components/properties/PropertySearch";

type ActiveView = "main" | "search" | "detail";

const INITIAL_FILTERS: PropertyFilters = {
  keyword: "",
  type: "all",
  location: "all",
  rooms: "all",
  operation: "all",
};

function parsePriceForSort(s: string): number {
  return Number(String(s || "").replace(/\./g, "").replace(/[^0-9]/g, "")) || 0;
}

let counterHasAnimated = false;

export default function HomePage() {
  const [view, setView] = useState<ActiveView>("main");
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PropertyFilters>(INITIAL_FILTERS);
  const [searchResults, setSearchResults] = useState<Property[]>([]);
  const [sortOrder, setSortOrder] = useState("default");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [lastView, setLastView] = useState<ActiveView>("main");
  const [lastScrollY, setLastScrollY] = useState(0);
  const [counter46, setCounter46] = useState(counterHasAnimated ? 46 : 0);
  const counterRef = useRef<HTMLSpanElement>(null);

  // ── Load properties ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("publish_status", "Publicada")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

      setProperties(
        error || !data?.length
          ? DEFAULT_PROPERTIES
          : data.map((r) => mapDbRow(r as Record<string, unknown>))
      );
      setLoading(false);
    };
    load();
  }, []);

  // ── Read ?op= URL param after properties load ────────────────────────────
  useEffect(() => {
    if (loading || !properties.length) return;
    const params = new URLSearchParams(window.location.search);
    const op = params.get("op");
    if (op === "venta" || op === "alquiler") {
      window.history.replaceState({}, "", "/");
      const newFilters = { ...INITIAL_FILTERS, operation: op };
      setFilters(newFilters);
      runSearchWithFilters(newFilters, properties);
    }
  }, [loading, properties]); // eslint-disable-line

  // ── Counter animation ─────────────────────────────────────────────────────
  useEffect(() => {
    // Re-check after view resets to main
    if (view !== "main") return;
    const el = counterRef.current;
    if (!el) return;
    // Lower threshold so mobile can trigger it even with partial visibility
    if (counterHasAnimated) { setCounter46(46); return; }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        counterHasAnimated = true;
        let n = 0;
        const step = () => { n++; setCounter46(n); if (n < 46) setTimeout(step, 22); };
        step();
        obs.unobserve(el);
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, view]);

  // ── Custom event: nav Venta / Alquileres ────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { op } = (e as CustomEvent<{ op: string }>).detail;
      const newFilters = { ...INITIAL_FILTERS, operation: op };
      setFilters(newFilters);
      runSearchWithFilters(newFilters, properties);
    };
    window.addEventListener("nivel-quick-search", handler);
    return () => window.removeEventListener("nivel-quick-search", handler);
  }, [properties]); // eslint-disable-line

  // ── Custom event: nav Inicio → resetear a vista principal ───────────────
  useEffect(() => {
    const handler = () => {
      setView("main");
      setSelectedProperty(null);
      setFilters(INITIAL_FILTERS);
      window.location.hash = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("nivel-go-home", handler);
    return () => window.removeEventListener("nivel-go-home", handler);
  }, []);

  // ── Hash routing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash.startsWith("propiedad-")) {
        const id = hash.replace("propiedad-", "");
        const prop = properties.find((p) => String(p.id) === id);
        if (prop) openDetail(prop);
      } else if (!hash || hash === "inicio") {
        setView("main");
      }
    };
    window.addEventListener("hashchange", handleHash);
    handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, [properties]); // eslint-disable-line

  // ── Derived ──────────────────────────────────────────────────────────────
  const featuredSales = properties.filter((p) => p.operation === "venta" && p.featured);
  const locations = [...new Set(properties.map((p) => p.location).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es")
  );

  // ── Core search logic ─────────────────────────────────────────────────────
  function runSearchWithFilters(f: PropertyFilters, src: Property[]) {
    const kw = f.keyword.toLowerCase().trim();
    const results = src.filter((p) => {
      const text = `${p.title} ${p.type} ${p.location} ${p.zone} ${p.address}`.toLowerCase();
      return (
        (!kw || text.includes(kw)) &&
        (f.type === "all" || p.type === f.type) &&
        (f.location === "all" || p.location === f.location) &&
        matchesRooms(p.rooms, f.rooms) &&
        (f.operation === "all" || p.operation === f.operation)
      );
    });
    setSearchResults(results);
    setSortOrder("default");
    setLastScrollY(window.scrollY);
    setView("search");
    window.location.hash = "busqueda";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function runSearch(overrideFilters?: PropertyFilters) {
    runSearchWithFilters(overrideFilters ?? filters, properties);
  }

  function quickSearch(operation: string) {
    const newFilters = { ...INITIAL_FILTERS, operation };
    setFilters(newFilters);
    runSearchWithFilters(newFilters, properties);
  }

  function openDetail(property: Property) {
    setLastScrollY(window.scrollY);
    setLastView(view);
    setSelectedProperty(property);
    setView("detail");
    window.location.hash = `propiedad-${property.id}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    if (lastView === "search" && searchResults.length > 0) {
      setView("search");
      window.location.hash = "busqueda";
      setTimeout(() => window.scrollTo({ top: lastScrollY, behavior: "smooth" }), 50);
    } else {
      setView("main");
      window.location.hash = "inicio";
      setTimeout(() => window.scrollTo({ top: lastScrollY, behavior: "smooth" }), 50);
    }
  }

  function clearSearch() {
    setFilters(INITIAL_FILTERS);
    setSearchResults([]);
    setView("main");
    window.location.hash = "inicio";
    setTimeout(() => document.getElementById("inicio")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const sortedResults = useCallback(() => {
    if (sortOrder === "price-asc") return [...searchResults].sort((a, b) => parsePriceForSort(a.price) - parsePriceForSort(b.price));
    if (sortOrder === "price-desc") return [...searchResults].sort((a, b) => parsePriceForSort(b.price) - parsePriceForSort(a.price));
    return searchResults;
  }, [searchResults, sortOrder]);

  const handleContactForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.querySelector("#formName") as HTMLInputElement)?.value.trim();
    const phone = (form.querySelector("#formPhone") as HTMLInputElement)?.value.trim();
    const email = (form.querySelector("#formEmail") as HTMLInputElement)?.value.trim();
    const reason = (form.querySelector("#formReason") as HTMLSelectElement)?.value;
    const message = (form.querySelector("#formMessage") as HTMLTextAreaElement)?.value.trim();

    if (reason === "Desarrolladores") {
      const subject = encodeURIComponent("Propuesta de desarrollo - Nivel Propiedades");
      const body = encodeURIComponent(`Hola, soy ${name}.\nTel: ${phone}\nEmail: ${email || "-"}\n\n${message || ""}`);
      window.location.href = `mailto:nivelconsultas@gmail.com?subject=${subject}&body=${body}`;
      return;
    }
    const msg = `Hola Nivel Propiedades, soy ${name}. Motivo: ${reason}. Tel: ${phone}. ${email ? `Email: ${email}. ` : ""}${message || ""}`;
    window.open(buildWhatsappLink(msg), "_blank");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // View: Detail
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "detail" && selectedProperty) {
    return (
      <AnimatePresence mode="wait">
        <PropertyDetail key={String(selectedProperty.id)} property={selectedProperty} onBack={goBack} />
      </AnimatePresence>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // View: Search
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "search") {
    const results = sortedResults();
    const activeFilters = Object.entries(filters).filter(([, v]) => v !== "all" && v !== "");

    return (
      <AnimatePresence mode="wait">
        <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className="bg-[#f7f7f6] border-b border-[#e5e5e5]">
            <div className="container-site py-8">
              <p className="section-kicker mb-3">Búsqueda</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0a0a0a] mb-5" style={{ letterSpacing: "-0.03em" }}>
                Resultados encontrados
              </h1>
              <PropertySearch filters={filters} locations={locations} onChange={setFilters} onSearch={() => runSearch()} />
            </div>
          </div>

          <div className="container-site py-8 sm:py-10">
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={clearSearch}
                  className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors"
                >
                  <X size={12} /> Limpiar
                </button>
                {activeFilters.map(([, v]) => (
                  <span key={v} className="text-[10px] font-semibold uppercase tracking-wide border border-[#e5e5e5] px-2 py-1 text-[#6b6b6b]">
                    {v}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-[#a3a3a3] uppercase tracking-wide">
                  {results.length} propiedad{results.length !== 1 ? "es" : ""}
                </p>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="h-8 border border-[#e5e5e5] bg-white px-2 text-[11px] text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
                >
                  <option value="default">Relevancia</option>
                  <option value="price-asc">Precio ↑</option>
                  <option value="price-desc">Precio ↓</option>
                </select>
              </div>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((prop, i) => (
                  <PropertyCard key={prop.id} property={prop} onSelect={openDetail} index={i} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Search size={24} className="mx-auto text-[#d0d0d0] mb-3" />
                <p className="text-[#6b6b6b] font-medium">Sin resultados para esos filtros.</p>
                <p className="text-sm text-[#a3a3a3] mt-1">Probá con otros criterios o consultanos directamente.</p>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // View: Main
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <AnimatePresence mode="wait">
      <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>

        {/* ── HERO ─────────────────────────────────────────── */}
        <section
          id="inicio"
          className="relative flex flex-col justify-end bg-[#0a0a0a] overflow-hidden"
          style={{ minHeight: "calc(100svh - 72px)" }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: "url('/hero-bg.png')",
              filter: "grayscale(100%)",
              opacity: 0.3,
            }}
          />
          <div className="relative z-10 container-site pb-10 pt-16 sm:pb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/40 mb-5">
                Ramos Mejía · Zona Oeste
              </p>
              <h1
                className="font-bold text-white mb-5 text-balance"
                style={{ fontSize: "clamp(2.2rem, 6vw, 5.5rem)", letterSpacing: "-0.04em", lineHeight: "1.0" }}
              >
                Propiedades en<br />Zona Oeste.
              </h1>
              <p className="text-white/50 text-sm sm:text-[15px] leading-relaxed max-w-sm mb-8">
                Vendemos, alquilamos y administramos propiedades en Ramos Mejía. Más de 46 años de trayectoria.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => quickSearch("venta")}
                  className="h-12 px-6 bg-white text-[#0a0a0a] text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  Ver ventas <ArrowRight size={13} />
                </button>
                <button
                  onClick={() => quickSearch("alquiler")}
                  className="h-12 px-6 border border-white/25 text-white text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-white/10 transition-colors"
                >
                  Ver alquileres
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── SEARCH BAR ───────────────────────────────────── */}
        <section className="border-b border-[#e5e5e5]">
          <div className="container-site py-6 sm:py-8">
            <PropertySearch filters={filters} locations={locations} onChange={setFilters} onSearch={() => runSearch()} />
          </div>
        </section>

        {/* ── VENTA DESTACADA ───────────────────────────────── */}
        <section id="venta" className="py-12 sm:py-16">
          <div className="container-site">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <motion.p className="section-kicker mb-2" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
                  Venta
                </motion.p>
                <motion.h2
                  className="font-bold text-[#0a0a0a]"
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", letterSpacing: "-0.03em", lineHeight: "1.1" }}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
                >
                  Propiedades destacadas en venta
                </motion.h2>
              </div>
              <button
                onClick={() => quickSearch("venta")}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors flex-shrink-0"
              >
                Ver todas <ArrowRight size={12} />
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-[4/3] bg-[#f0f0f0] animate-pulse" />
                    <div className="h-3 bg-[#f0f0f0] animate-pulse w-1/3 rounded" />
                    <div className="h-4 bg-[#f0f0f0] animate-pulse w-2/3 rounded" />
                  </div>
                ))}
              </div>
            ) : featuredSales.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredSales.map((prop, i) => (
                  <PropertyCard key={prop.id} property={prop} onSelect={openDetail} index={i} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-[#e5e5e5]">
                <p className="text-[#a3a3a3] text-sm">Próximamente nuevas propiedades en venta.</p>
              </div>
            )}

            <div className="mt-8 text-center sm:hidden">
              <button
                onClick={() => quickSearch("venta")}
                className="h-10 px-7 border border-[#0a0a0a] text-[11px] font-bold tracking-wide uppercase hover:bg-[#0a0a0a] hover:text-white transition-colors"
              >
                Ver todas las ventas
              </button>
            </div>
          </div>
        </section>

        {/* ── BANNER: TASÁ TU PROPIEDAD ─────────────────────── */}
        <section className="bg-[#0a0a0a] py-12 sm:py-14">
          <div className="container-site">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <motion.p
                  className="text-[10px] font-bold tracking-[0.14em] uppercase text-white/30 flex items-center gap-3 mb-3"
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                >
                  <span className="inline-block w-5 h-px bg-white/30" /> Vendé tu propiedad
                </motion.p>
                <motion.h2
                  className="font-bold text-white mb-3"
                  style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", letterSpacing: "-0.03em", lineHeight: "1.1" }}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
                >
                  ¿Querés vender tu propiedad?
                </motion.h2>
                <p className="text-white/40 text-sm leading-relaxed max-w-md">
                  Tasamos con conocimiento real de la zona y una mirada comercial concreta. Salimos al mercado con estrategia clara y seguimiento desde el primer contacto.
                </p>
              </div>
              <a
                href={buildWhatsappLink("Hola Nivel Propiedades, quiero tasar mi propiedad")}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start sm:self-auto h-11 px-6 bg-white text-[#0a0a0a] text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-white/90 transition-colors flex items-center gap-2 flex-shrink-0"
              >
                Tasá tu propiedad
              </a>
            </div>
          </div>
        </section>

        {/* ── BANNER: ALQUILERES ────────────────────────────── */}
        <section id="alquileres" className="bg-[#f7f7f6] border-y border-[#e5e5e5] py-12 sm:py-14">
          <div className="container-site">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <motion.p
                  className="section-kicker mb-3"
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                >
                  Alquileres
                </motion.p>
                <motion.h2
                  className="font-bold text-[#0a0a0a] mb-3"
                  style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)", letterSpacing: "-0.03em", lineHeight: "1.1" }}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
                >
                  ¿Querés alquilar tu propiedad?
                </motion.h2>
                <p className="text-[#6b6b6b] text-sm leading-relaxed max-w-md">
                  Administramos y publicamos tu propiedad con una mirada clara, ordenada y cercana. Te acompañamos desde la publicación hasta la selección del inquilino.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <a
                  href={buildWhatsappLink("Hola Nivel Propiedades, quiero alquilar mi propiedad")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start h-11 px-6 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
                >
                  Quiero alquilar mi propiedad
                </a>
                <button
                  onClick={() => quickSearch("alquiler")}
                  className="self-start h-11 px-6 border border-[#0a0a0a] text-[#0a0a0a] text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#0a0a0a] hover:text-white transition-colors flex items-center gap-2"
                >
                  Ver propiedades en alquiler <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── ABOUT / STATS ─────────────────────────────────── */}
        <section className="py-12 sm:py-16">
          <div className="container-site">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <motion.p className="section-kicker mb-4" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
                  Sobre nosotros
                </motion.p>
                <motion.h2
                  className="font-bold text-[#0a0a0a] mb-5"
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", letterSpacing: "-0.03em", lineHeight: "1.1" }}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
                >
                  Una inmobiliaria familiar y local.
                </motion.h2>
                <p className="text-[#6b6b6b] leading-relaxed text-sm sm:text-[15px] mb-4">
                  Nivel Propiedades es una oficina inmobiliaria de Ramos Mejía con historia familiar. Hoy, en su tercera generación, seguimos administrando, alquilando y vendiendo propiedades en la zona.
                </p>
                <p className="text-[#6b6b6b] leading-relaxed text-sm sm:text-[15px] mb-7">
                  Conocemos el mercado local, entendemos el valor de cada propiedad y acompañamos a cada cliente de principio a fin.
                </p>
                <Link
                  href="/nosotros"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-[#0a0a0a] border-b border-[#0a0a0a] pb-px hover:text-[#6b6b6b] hover:border-[#6b6b6b] transition-colors"
                >
                  Conocer más <ArrowRight size={11} />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  className="border border-[#e5e5e5] bg-[#f7f7f6] p-6 sm:p-8"
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
                >
                  <p className="font-bold text-[#0a0a0a] leading-none mb-2" style={{ fontSize: "clamp(2.5rem, 7vw, 4rem)", letterSpacing: "-0.04em" }}>
                    <span ref={counterRef}>{counter46}</span>+
                  </p>
                  <p className="text-[10px] text-[#a3a3a3] uppercase tracking-[0.1em] font-semibold">Años de trayectoria</p>
                </motion.div>

                <motion.div
                  className="border border-[#e5e5e5] bg-[#f7f7f6] p-6 sm:p-8"
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <p className="font-bold text-[#0a0a0a] leading-none mb-2" style={{ fontSize: "clamp(2.5rem, 7vw, 4rem)", letterSpacing: "-0.04em" }}>
                    3ª
                  </p>
                  <p className="text-[10px] text-[#a3a3a3] uppercase tracking-[0.1em] font-semibold">Generación</p>
                </motion.div>

                <motion.div
                  className="border border-[#e5e5e5] bg-[#f7f7f6] p-6 col-span-2"
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    {["Venta", "Alquileres", "Administración", "Tasaciones"].map((s) => (
                      <div key={s} className="flex items-center gap-2 text-[13px] text-[#0a0a0a] font-medium">
                        <span className="w-1 h-1 rounded-full bg-[#0a0a0a] flex-shrink-0" />
                        {s}
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CONTACTO ──────────────────────────────────────── */}
        <section id="contacto" className="py-12 sm:py-16 border-t border-[#e5e5e5]">
          <div className="container-site">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
              <div>
                <motion.p className="section-kicker mb-4" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
                  Contacto
                </motion.p>
                <motion.h2
                  className="font-bold text-[#0a0a0a] mb-5"
                  style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", letterSpacing: "-0.03em", lineHeight: "1.1" }}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
                >
                  Hablemos de tu propiedad.
                </motion.h2>
                <p className="text-[#6b6b6b] text-sm sm:text-[15px] leading-relaxed mb-8">
                  Consultanos sin compromiso. Te respondemos a la brevedad.
                </p>
                <div className="divide-y divide-[#f0f0f0]">
                  {[
                    { label: "Dirección", value: "Av. Gaona 2422, Ramos Mejía" },
                    { label: "Teléfono", value: "4654-0122", href: "tel:+541146540122" },
                    { label: "WhatsApp", value: "11 6683-8275", href: "https://wa.me/5491166838275" },
                    { label: "Mail", value: "nivelconsultas@gmail.com", href: "mailto:nivelconsultas@gmail.com" },
                  ].map((c) => (
                    <div key={c.label} className="flex gap-5 items-center py-4">
                      <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] w-16 flex-shrink-0">{c.label}</span>
                      {c.href ? (
                        <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                          className="text-[14px] text-[#0a0a0a] hover:text-[#6b6b6b] transition-colors font-medium break-all">
                          {c.value}
                        </a>
                      ) : (
                        <span className="text-[14px] text-[#0a0a0a] font-medium">{c.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
                <form onSubmit={handleContactForm} className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="formName" className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] block mb-1.5">Nombre *</label>
                      <input id="formName" type="text" required placeholder="Tu nombre"
                        className="w-full h-10 border border-[#e5e5e5] px-3 text-sm placeholder:text-[#c0c0c0] focus:border-[#0a0a0a] focus:outline-none" />
                    </div>
                    <div>
                      <label htmlFor="formPhone" className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] block mb-1.5">Teléfono *</label>
                      <input id="formPhone" type="tel" required placeholder="Tu teléfono"
                        className="w-full h-10 border border-[#e5e5e5] px-3 text-sm placeholder:text-[#c0c0c0] focus:border-[#0a0a0a] focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="formEmail" className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] block mb-1.5">Email</label>
                    <input id="formEmail" type="email" placeholder="tu@email.com"
                      className="w-full h-10 border border-[#e5e5e5] px-3 text-sm placeholder:text-[#c0c0c0] focus:border-[#0a0a0a] focus:outline-none" />
                  </div>
                  <div>
                    <label htmlFor="formReason" className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] block mb-1.5">Motivo *</label>
                    <select id="formReason" required
                      className="w-full h-10 border border-[#e5e5e5] px-3 text-sm text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none appearance-none bg-white">
                      <option value="">Seleccioná</option>
                      <option>Quiero vender</option>
                      <option>Quiero tasar</option>
                      <option>Quiero alquilar mi propiedad</option>
                      <option>Busco propiedad para comprar</option>
                      <option>Busco propiedad para alquilar</option>
                      <option>Administración</option>
                      <option>Desarrolladores</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="formMessage" className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#a3a3a3] block mb-1.5">Mensaje</label>
                    <textarea id="formMessage" rows={4} placeholder="¿En qué podemos ayudarte?"
                      className="w-full border border-[#e5e5e5] px-3 py-2.5 text-sm placeholder:text-[#c0c0c0] focus:border-[#0a0a0a] focus:outline-none resize-none" />
                  </div>
                  <button type="submit"
                    className="h-11 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#1a1a1a] transition-colors">
                    Enviar consulta
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        </section>

      </motion.div>
    </AnimatePresence>
  );
}
