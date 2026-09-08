"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Property } from "@/types/property";
import { formatMoney, buildWhatsappLink, getPropertyPath } from "@/lib/utils";

interface PropertyCardProps {
  property: Property;
  onSelect: (property: Property) => void;
  index?: number;
}

export function PropertyCard({ property, onSelect, index = 0 }: PropertyCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
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

  // Click normal abre en el mismo SPA (onSelect); cmd/ctrl/shift/click-medio
  // dejan que el navegador abra en pestaña nueva, ya que el href es real.
  const handleCardClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    onSelect(property);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col"
    >
      {/* Toda la imagen + info principal abre la ficha; los botones de abajo quedan aparte */}
      <Link
        href={getPropertyPath(property.id)}
        onClick={handleCardClick}
        className="flex flex-col cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
      >
        <div className="relative overflow-hidden bg-[#f7f7f6] aspect-[4/3]">
          {!imgLoaded && <div className="absolute inset-0 bg-[#eeeeec] animate-pulse" />}
          <Image
            src={imgSrc}
            alt={property.title}
            fill
            className={`object-cover transition-all duration-700 ease-out group-hover:scale-[1.03] ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onLoad={() => setImgLoaded(true)}
          />
          <div className="absolute top-3 left-3">
            <Badge variant={property.operation === "venta" ? "sale" : "rental"}>
              {operationLabel}
            </Badge>
          </div>
        </div>

        <div className="pt-4">
          <div className="flex items-center gap-1.5 text-[11px] text-[#a3a3a3] tracking-wide mb-1.5">
            <MapPin size={11} strokeWidth={2} />
            <span>{property.zone}</span>
          </div>

          <h3
            className="text-[0.95rem] font-bold text-[#0a0a0a] leading-snug mb-2 group-hover:underline underline-offset-2"
            style={{ letterSpacing: "-0.02em" }}
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
        </div>
      </Link>

      <div className="mt-auto flex gap-2 pt-2 border-t border-[#f0f0f0]">
        <button
          onClick={() => onSelect(property)}
          className="flex-1 h-10 min-h-[44px] text-[11px] font-semibold tracking-[0.08em] uppercase border border-[#0a0a0a] text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
        >
          Ver propiedad
        </button>
        <a
          href={buildWhatsappLink(whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-10 min-h-[44px] text-[11px] font-semibold tracking-[0.08em] uppercase border border-[#e5e5e5] text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] active:scale-[0.98] transition-all duration-150 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
        >
          Consultar
        </a>
      </div>
    </motion.article>
  );
}
