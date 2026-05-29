import type { Metadata } from "next";
import { MapPin, Handshake, BarChart3 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Desarrolladores",
  description:
    "Nivel Propiedades busca trabajar con desarrolladores y constructoras de Zona Oeste. Conocimiento local, relación directa y presentación comercial moderna.",
};

const items = [
  {
    icon: MapPin,
    title: "Conocimiento local",
    text: "Trabajamos en Ramos Mejía y alrededores, con lectura real del mercado.",
  },
  {
    icon: Handshake,
    title: "Relación directa",
    text: "Atención cercana, seguimiento y compromiso con cada proyecto.",
  },
  {
    icon: BarChart3,
    title: "Presentación comercial",
    text: "Combinamos presencia local con una imagen moderna y profesional.",
  },
];

export default function DesarrolladoresPage() {
  return (
    <div className="min-h-screen">
      {/* Page hero */}
      <div className="bg-[#f7f7f6] border-b border-[#e5e5e5]">
        <div className="container-site py-14">
          <p className="section-kicker mb-4">Desarrolladores</p>
          <h1
            className="font-bold text-[#0a0a0a]"
            style={{
              fontSize: "clamp(2.2rem, 5vw, 4rem)",
              letterSpacing: "-0.05em",
              lineHeight: "0.92",
            }}
          >
            Queremos trabajar con
            <br />
            <em>desarrolladores de la zona.</em>
          </h1>
        </div>
      </div>

      <section className="py-12 sm:py-16 bg-[#f7f7f6]">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            {/* Image */}
            <div className="relative aspect-[4/5] bg-[#e5e5e5] overflow-hidden">
              <Image
                src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1400&auto=format&fit=crop"
                alt="Desarrollo inmobiliario"
                fill
                className="object-cover"
                style={{ filter: "grayscale(100%)" }}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            {/* Content */}
            <div>
              <div className="grid gap-4 mb-10">
                <p className="text-[#444] text-[15px] leading-[1.9]">
                  Buscamos abrir una nueva etapa comercial junto a constructoras y desarrolladores que necesiten una inmobiliaria local, seria y presente en Zona Oeste.
                </p>
                <p className="text-[#444] text-[15px] leading-[1.9]">
                  Nuestro aporte está en la cercanía con el mercado, el conocimiento de la zona y una forma de comunicación más actual para presentar cada proyecto.
                </p>
              </div>

              <div className="grid gap-0 border-t border-[#e5e5e5] mb-10">
                {items.map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 items-start py-5 border-b border-[#e5e5e5] group"
                  >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon size={16} className="text-[#a3a3a3]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0a0a0a] mb-1">{item.title}</p>
                      <p className="text-[13px] text-[#6b6b6b] leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="mailto:nivelconsultas@gmail.com?subject=Propuesta%20de%20desarrollo%20inmobiliario%20-%20Nivel%20Propiedades"
                className="inline-flex items-center justify-center h-12 px-8 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.1em] uppercase hover:bg-[#1a1a1a] transition-colors"
              >
                Quiero proponer un desarrollo
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
