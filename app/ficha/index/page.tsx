"use client";

// Esta página actúa como shell para TODAS las URLs /ficha/* del sitio estático.
// Netlify redirige /ficha/* → /ficha/index (status 200, sin cambiar la URL del browser).
// El componente FichaFormWrapper lee la URL real desde window.location en el cliente.

import { FichaFormWrapper } from "@/components/solicitudes/FichaFormWrapper";

export default function FichaIndexPage() {
  return <FichaFormWrapper />;
}
