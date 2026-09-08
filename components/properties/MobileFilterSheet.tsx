"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type PropertyFilters } from "@/types/property";
import { PROPERTY_TYPES, ROOM_OPTIONS } from "@/components/properties/PropertySearch";

interface Props {
  filters: PropertyFilters;
  locations: string[];
  onChange: (filters: PropertyFilters) => void;
  onSearch: (overrideFilters?: PropertyFilters) => void;
}

const SELECT_CLASS =
  "h-12 min-h-[44px] w-full border border-[#e5e5e5] bg-white px-3 text-sm text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none appearance-none";

/** Bottom sheet de filtros para celular — en desktop se usa PropertySearch directamente. */
export function MobileFilterSheet({ filters, locations, onChange, onSearch }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PropertyFilters>(filters);
  const reduceMotion = useReducedMotion();

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => k !== "keyword" && v !== "all" && v !== ""
  ).length;

  const openSheet = () => {
    setDraft(filters);
    setOpen(true);
  };

  const applyAndClose = () => {
    onChange(draft);
    onSearch(draft);
    setOpen(false);
  };

  const clearDraft = () => {
    const cleared: PropertyFilters = { keyword: draft.keyword, type: "all", location: "all", rooms: "all", operation: "all" };
    setDraft(cleared);
  };

  const set = (key: keyof PropertyFilters, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="lg:hidden bg-white border border-[#e5e5e5] p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Buscar propiedad, zona..."
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            className="pr-10 h-12 min-h-[44px]"
          />
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={openSheet}
          className="relative h-12 min-h-[44px] px-4 flex items-center gap-2 border border-[#0a0a0a] text-[#0a0a0a] text-[11px] font-semibold tracking-[0.06em] uppercase active:scale-[0.98] transition-all duration-150 flex-shrink-0"
          aria-label={`Filtros${activeCount > 0 ? `, ${activeCount} activos` : ""}`}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-[#0a0a0a] text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
                  className="fixed inset-0 z-[100] bg-black/50"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
                  animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-x-0 bottom-0 z-[101] bg-white max-h-[85dvh] flex flex-col outline-none rounded-t-xl"
                >
                  <Dialog.Title className="sr-only">Filtros de búsqueda</Dialog.Title>

                  <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0] flex-shrink-0">
                    <h2 className="text-sm font-bold uppercase tracking-[0.08em]">Filtros</h2>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Cerrar filtros"
                        className="w-11 h-11 flex items-center justify-center text-[#6b6b6b] active:scale-[0.98] transition-all"
                      >
                        <X size={20} />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div className="overflow-y-auto px-5 py-5 flex flex-col gap-5 flex-1">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">Operación</p>
                      <select value={draft.operation} onChange={(e) => set("operation", e.target.value)} className={SELECT_CLASS}>
                        <option value="all">Todas</option>
                        <option value="venta">Venta</option>
                        <option value="alquiler">Alquiler</option>
                      </select>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">Tipo</p>
                      <select value={draft.type} onChange={(e) => set("type", e.target.value)} className={SELECT_CLASS}>
                        <option value="all">Todos los tipos</option>
                        {PROPERTY_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">Zona</p>
                      <select value={draft.location} onChange={(e) => set("location", e.target.value)} className={SELECT_CLASS}>
                        <option value="all">Todas las zonas</option>
                        {locations.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3] mb-2">Ambientes</p>
                      <div className="flex flex-wrap gap-2">
                        {ROOM_OPTIONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => set("rooms", r)}
                            className={`h-10 min-h-[44px] px-4 text-[11px] font-semibold tracking-[0.06em] uppercase border active:scale-[0.98] transition-all duration-150 ${
                              draft.rooms === r
                                ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                                : "border-[#e5e5e5] text-[#6b6b6b]"
                            }`}
                          >
                            {r === "all" ? "Todos" : r === "5" ? "5+" : `${r} amb.`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-3 px-5 pt-4 border-t border-[#f0f0f0] flex-shrink-0"
                    style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                  >
                    <button
                      type="button"
                      onClick={clearDraft}
                      className="h-12 min-h-[44px] px-5 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6b6b6b] active:scale-[0.98] transition-all duration-150"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={applyAndClose}
                      className="flex-1 h-12 min-h-[44px] bg-[#0a0a0a] text-white text-[11px] font-semibold tracking-[0.08em] uppercase active:scale-[0.98] transition-all duration-150"
                    >
                      Ver resultados
                    </button>
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </div>
  );
}
