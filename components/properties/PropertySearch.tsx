"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type PropertyFilters } from "@/types/property";

interface PropertySearchProps {
  filters: PropertyFilters;
  locations: string[];
  onChange: (filters: PropertyFilters) => void;
  onSearch: () => void;
}

const PROPERTY_TYPES = ["Departamento", "Casa", "PH", "Lote", "Terreno", "Local", "Oficina"];

export function PropertySearch({ filters, locations, onChange, onSearch }: PropertySearchProps) {
  const set = (key: keyof PropertyFilters, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="bg-white border border-[#e5e5e5] p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Keyword */}
        <div className="relative lg:col-span-2">
          <Input
            type="text"
            placeholder="Buscar propiedad, zona..."
            value={filters.keyword}
            onChange={(e) => set("keyword", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            className="pr-10"
          />
          <Search
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a3a3a3] pointer-events-none"
          />
        </div>

        {/* Operation */}
        <select
          value={filters.operation}
          onChange={(e) => set("operation", e.target.value)}
          className="h-11 border border-[#e5e5e5] bg-white px-3 text-sm text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none appearance-none"
        >
          <option value="all">Operación</option>
          <option value="venta">Venta</option>
          <option value="alquiler">Alquiler</option>
        </select>

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => set("type", e.target.value)}
          className="h-11 border border-[#e5e5e5] bg-white px-3 text-sm text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none appearance-none"
        >
          <option value="all">Tipo</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Location */}
        <select
          value={filters.location}
          onChange={(e) => set("location", e.target.value)}
          className="h-11 border border-[#e5e5e5] bg-white px-3 text-sm text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none appearance-none"
        >
          <option value="all">Todas las zonas</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between mt-3 gap-3">
        {/* Rooms quick filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "1", "2", "3", "4", "5"].map((r) => (
            <button
              key={r}
              onClick={() => set("rooms", r)}
              className={`h-7 px-3 text-[10px] font-semibold tracking-[0.08em] uppercase border transition-colors ${
                filters.rooms === r
                  ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                  : "border-[#e5e5e5] text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
              }`}
            >
              {r === "all" ? "Todos" : r === "5" ? "5+" : `${r} amb.`}
            </button>
          ))}
        </div>

        <button
          onClick={onSearch}
          className="h-9 px-6 bg-[#0a0a0a] text-white text-[11px] font-semibold tracking-[0.08em] uppercase hover:bg-[#1a1a1a] transition-colors flex-shrink-0"
        >
          Buscar
        </button>
      </div>
    </div>
  );
}
