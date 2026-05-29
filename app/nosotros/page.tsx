import type { Metadata } from "next";

import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description:
    "Nivel Propiedades es una inmobiliaria familiar de Ramos Mejía, en su tercera generación. Más de 46 años de trayectoria en venta, alquiler y administración de propiedades.",
};

const services = [
  "Venta de propiedades",
  "Alquileres",
  "Administración",
  "Tasaciones",
];

export default function NosotrosPage() {
  return (
    <div className="min-h-screen">
      {/* Page hero */}
      <div className="bg-[#f7f7f6] border-b border-[#e5e5e5]">
        <div className="container-site py-14">
          <p className="section-kicker mb-4">Sobre nosotros</p>
          <h1
            className="font-bold text-[#0a0a0a]"
            style={{
              fontSize: "clamp(2.2rem, 5vw, 4rem)",
              letterSpacing: "-0.05em",
              lineHeight: "0.92",
            }}
          >
            Una inmobiliaria familiar,
            <br />
            <em>local y de tercera generación.</em>
          </h1>
        </div>
      </div>

      {/* Content */}
      <section className="py-12 sm:py-16">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-16 items-start">
            {/* Left: counter + services */}
            <div>
              <div className="mb-8">
                <p
                  className="font-bold text-[#0a0a0a] leading-none"
                  style={{
                    fontSize: "clamp(5rem, 12vw, 9rem)",
                    letterSpacing: "-0.06em",
                  }}
                >
                  46<span className="text-[#a3a3a3]">+</span>
                </p>
                <p className="text-[#6b6b6b] text-[15px] leading-relaxed mt-3 max-w-xs">
                  Años de trayectoria en Ramos Mejía, administrando, alquilando y vendiendo en la zona de siempre.
                </p>
              </div>

              <div className="grid gap-px border border-[#e5e5e5]">
                {services.map((s) => (
                  <div
                    key={s}
                    className="flex items-center gap-3 px-5 py-4 bg-white text-[13px] font-medium text-[#0a0a0a] border-b border-[#e5e5e5] last:border-0 hover:bg-[#f7f7f6] transition-colors"
                  >
                    <span className="w-1 h-1 rounded-full bg-[#0a0a0a] flex-shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: narrative */}
            <div>
              <p className="section-kicker mb-5">Nuestra historia</p>
              <h2
                className="font-bold text-[#0a0a0a] mb-8"
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
                  letterSpacing: "-0.04em",
                  lineHeight: "0.95",
                }}
              >
                El negocio familiar que conoce la zona de siempre.
              </h2>

              <div className="grid gap-5">
                <p className="text-[#444] leading-[1.9] text-[15px]">
                  Nivel Propiedades – Negocios Inmobiliarios es una oficina inmobiliaria de Ramos Mejía con una historia familiar ligada al mercado local, clientes de años y operaciones construidas sobre confianza, seriedad y presencia.
                </p>
                <p className="text-[#444] leading-[1.9] text-[15px]">
                  Hoy la oficina continúa en una nueva etapa, con la tercera generación involucrada en el negocio, manteniendo la base que siempre nos caracterizó: administrar, alquilar y vender propiedades en Ramos Mejía y Zona Oeste.
                </p>
                <p className="text-[#444] leading-[1.9] text-[15px]">
                  Seguimos trabajando en la zona de siempre, con el mismo compromiso, pero con una imagen renovada y una forma de comunicar más actual. Conocemos el mercado local, entendemos el valor de cada propiedad y acompañamos a cada cliente de principio a fin.
                </p>
              </div>

              <div className="mt-10 pt-8 border-t border-[#e5e5e5]">
                <Link
                  href="/contacto"
                  className="inline-flex items-center gap-2 h-11 px-7 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#1a1a1a] transition-colors"
                >
                  Contactarnos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
