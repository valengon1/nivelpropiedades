"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve si un media query matchea. `null` hasta el primer efecto (SSR/hidratación),
 * así el caller puede evitar renderizar nada hasta saber el viewport real.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
