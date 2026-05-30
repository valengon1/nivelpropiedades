"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Property } from "@/types/property";
import { formatMoney, buildWhatsappLink } from "@/lib/utils";

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
  index?: number;
}

export function PropertyCard({ property, onSelect, index = 0 }: PropertyCardProps) {
  const operationLabel = property.operation === "venta" ? "Venta" : "Alquiler";
  const imgSrc = property.image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=800&auto=format&fit=crop";

  const whatsappMessage =
    `Hola Nivel Propiedades, quiero consultar por esta propiedad: ${property.title}. ` +
    `Ubicación: ${property.zone}. Operación: ${operationLabel}. Precio: ${formatMoney(property.price)}.`;

  const details = property.details?.length
    ? property.details
    : [
        property.rooms ? `${property.rooms} amb.` : null,
        property.meters,
        property.highlight,
      ].filter(Boolean) as string[];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col cursor-pointer"
    >
      {/* Image */}
      <div
        className="relative overflow-hidden bg-[#f7f7f6] aspect-[4/3]"
        onClick={() => onSelect(property)}
      >
        <Image
          src={imgSrc}
          alt={property.title}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/watermark.png" alt="" className="w-1/2 h-auto" style={{ opacity: 0.72 }} />
        </div>
        <div className="absolute top-3 left-3">
          <Badge variant={property.operation === "venta" ? "sale" : "rental"}>
            {operationLabel}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4 flex flex-col flex-1">
        <div
          className="flex items-center gap-1.5 text-[11px] text-[#a3a3a3] tracking-wide mb-1.5 cursor-pointer"
          onClick={() => onSelect(property)}
        >
          <MapPin size={11} strokeWidth={2} />
          <span>{property.zone}</span>
        </div>

        <h3
          className="text-[0.95rem] font-bold text-[#0a0a0a] leading-snug mb-2 cursor-pointer hover:underline underline-offset-2"
          style={{ letterSpacing: "-0.02em" }}
          onClick={() => onSelect(property)}
        >
          {property.title}
        </h3>

        <p className="text-[#0a0a0a] font-semibold text-sm tracking-wide mb-3">
          {formatMoney(property.price)}
        </p>

        {details.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {details.map((d, i) => (
              <span key={i} className="text-[11px] text-[#6b6b6b] uppercase tracking-[0.08em]">
                {d}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2 border-t border-[#f0f0f0]">
          <button
            onClick={() => onSelect(property)}
            className="flex-1 h-9 text-[11px] font-semibold tracking-[0.08em] uppercase border border-[#0a0a0a] text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors duration-200"
          >
            Ver propiedad
          </button>
          <a
            href={buildWhatsappLink(whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-9 text-[11px] font-semibold tracking-[0.08em] uppercase border border-[#e5e5e5] text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors duration-200 flex items-center justify-center"
          >
            Consultar
          </a>
        </div>
      </div>
    </motion.article>
  );
}
