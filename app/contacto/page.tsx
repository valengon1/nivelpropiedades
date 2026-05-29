import type { Metadata } from "next";
import { MapPin, Phone, MessageSquare, Mail, Clock } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contactanos en Nivel Propiedades. Encontranos en Av. Gaona 2422, Ramos Mejía. Lunes a Viernes 10 a 13 y 17 a 19 hs.",
};

const contactItems = [
  {
    icon: MessageSquare,
    label: "WhatsApp",
    value: "11 6683-8275",
    href: "https://wa.me/5491166838275",
  },
  {
    icon: Phone,
    label: "Teléfono",
    value: "4654-0122",
    href: "tel:+541146540122",
  },
  {
    icon: Mail,
    label: "Mail",
    value: "nivelconsultas@gmail.com",
    href: "mailto:nivelconsultas@gmail.com",
  },
  {
    icon: MapPin,
    label: "Dirección",
    value: "Av. Gaona 2422, Ramos Mejía",
    href: undefined,
  },
];

const hours = [
  { day: "Lunes a Viernes", time: "10:00 – 13:00 y 17:00 – 19:00 hs" },
  { day: "Sábados", time: "Cerrado" },
  { day: "Domingos", time: "Cerrado" },
];

export default function ContactoPage() {
  return (
    <div className="min-h-screen">
      {/* Page hero */}
      <div className="bg-[#f7f7f6] border-b border-[#e5e5e5]">
        <div className="container-site py-14">
          <p className="section-kicker mb-4">Contacto</p>
          <h1
            className="font-bold text-[#0a0a0a]"
            style={{
              fontSize: "clamp(2.2rem, 5vw, 4rem)",
              letterSpacing: "-0.05em",
              lineHeight: "0.92",
            }}
          >
            Encontranos.
          </h1>
        </div>
      </div>

      <section className="py-10 sm:py-14">
        <div className="container-site">
          {/*
            Mobile order:  1-Contacto  2-Horarios  3-Mapa
            Desktop order: Mapa (col1, rowspan2) | Contacto (col2 row1) | Horarios (col2 row2)
          */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 lg:gap-8">

            {/* Cómo contactarnos — mobile: 1º, desktop: col 2 row 1 */}
            <div className="order-1 lg:col-start-2 lg:row-start-1 border border-[#e5e5e5] p-6 bg-white">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#a3a3a3] mb-5">
                Cómo contactarnos
              </p>
              <div className="grid gap-0">
                {contactItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 py-3 border-b border-[#f0f0f0] last:border-0 last:pb-0 first:pt-0"
                  >
                    <item.icon size={14} className="text-[#a3a3a3] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#a3a3a3] mb-0.5">
                        {item.label}
                      </p>
                      {item.href ? (
                        <a
                          href={item.href}
                          target={item.href.startsWith("http") ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className="text-[14px] text-[#0a0a0a] hover:text-[#6b6b6b] transition-colors font-medium"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <span className="text-[14px] text-[#0a0a0a] font-medium">{item.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Horarios — mobile: 2º, desktop: col 2 row 2 */}
            <div className="order-2 lg:col-start-2 lg:row-start-2 border border-[#e5e5e5] p-6 bg-white">
              <div className="flex items-center gap-2 mb-5">
                <Clock size={14} className="text-[#a3a3a3]" />
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#a3a3a3]">
                  Horarios de atención
                </p>
              </div>
              <div className="grid gap-0">
                {hours.map((h) => (
                  <div
                    key={h.day}
                    className="flex justify-between items-center py-3 border-b border-[#f0f0f0] last:border-0 last:pb-0 first:pt-0"
                  >
                    <span className="text-[13px] font-semibold text-[#0a0a0a]">{h.day}</span>
                    <span className={`text-[13px] ${h.time === "Cerrado" ? "text-[#c0c0c0]" : "text-[#6b6b6b]"}`}>
                      {h.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mapa — mobile: 3º, desktop: col 1 spanneando ambas filas */}
            <div className="order-3 lg:col-start-1 lg:row-start-1 lg:row-span-2 border border-[#e5e5e5] overflow-hidden flex flex-col">
              <div className="relative flex-1 bg-[#f7f7f6] min-h-[260px]">
                <iframe
                  src="https://maps.google.com/maps?q=Av+Gaona+2422+Ramos+Mejia+Buenos+Aires+Argentina&output=embed&hl=es&z=16"
                  style={{ border: 0, filter: "grayscale(100%)", display: "block", position: "absolute", inset: 0, width: "100%", height: "100%" }}
                  allowFullScreen
                  loading="lazy"
                  title="Ubicación Nivel Propiedades"
                />
              </div>
              <div className="px-5 py-4 border-t border-[#e5e5e5] flex items-center gap-2 text-[13px] text-[#6b6b6b] flex-shrink-0">
                <MapPin size={14} />
                Av. Gaona 2422, Ramos Mejía, Buenos Aires
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
