"use client";

import { useMediaQuery } from "@/lib/useMediaQuery";
import { PropertySearch } from "@/components/properties/PropertySearch";
import { MobileFilterSheet } from "@/components/properties/MobileFilterSheet";
import { type PropertyFilters } from "@/types/property";

interface Props {
  filters: PropertyFilters;
  locations: string[];
  onChange: (filters: PropertyFilters) => void;
  onSearch: (overrideFilters?: PropertyFilters) => void;
}

/**
 * Monta SOLO uno de los dos (nunca ambos a la vez): en desktop el panel
 * inline de PropertySearch, en celular el bottom sheet. Montar los dos y
 * ocultar uno con CSS deja inputs/botones "fantasma" en el DOM —duplica
 * accesibles por rol/texto y rompe cualquier código (tests, lectores de
 * pantalla) que espere un único match.
 */
export function SearchControls({ filters, locations, onChange, onSearch }: Props) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (isDesktop === null) return null; // esperar a saber el viewport real, evita el doble render

  return isDesktop ? (
    <PropertySearch filters={filters} locations={locations} onChange={onChange} onSearch={onSearch} />
  ) : (
    <MobileFilterSheet filters={filters} locations={locations} onChange={onChange} onSearch={onSearch} />
  );
}
