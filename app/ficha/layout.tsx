import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ficha de Datos Personales | Nivel Propiedades",
  description: "Completá tu ficha de datos personales para la gestión inmobiliaria.",
  robots: "noindex, nofollow",
};

export default function FichaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f6]">
      {children}
    </div>
  );
}
