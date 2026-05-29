"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Share2, MessageCircle, Maximize2 } from "lucide-react";
import { type Property } from "@/types/property";
import { formatMoney, buildWhatsappLink } from "@/lib/utils";
import { PropertyLightbox } from "@/components/properties/PropertyLightbox";
import { Badge } from "@/components/ui/badge";

interface PropertyDetailProps {
  property: Property;
  onBack: () => void;
}

export function PropertyDetail({ property, onBack }: PropertyDetailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [thumbIndex, setThumbIndex] = useState(0);

  const images =
    property.images?.length
      ? property.images
      : [property.image].filter(Boolean) as string[];

  const operationLabel = property.operation === "venta" ? "Venta" : "Alquiler";

  const whatsappMessage =
    `Hola Nivel Propiedades, quiero consultar por esta propiedad: ${property.title}. ` +
    `Dirección: ${property.address}. Operación: ${operationLabel}. ` +
    `Precio: ${formatMoney(property.price)}.`;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: property.title, url: window.location.href }); } catch (_) {}
    } else {
      try { await navigator.clipboard.writeText(window.location.href); } catch (_) {}
    }
  };

  const specs = [
    { label: "Tipo", value: property.type },
    { label: "Operación", value: operationLabel },
    {
      label: "Ambientes",
      value: property.rooms === 0
        ? "No aplica"
        : `${property.rooms} ambiente${property.rooms === 1 ? "" : "s"}`,
    },
    { label: "Superficie", value: property.meters },
    { label: "Baños", value: property.bathrooms },
    { label: "Cochera", value: property.garage },
    { label: "Destaque", value: property.highlight },
  ].filter((s) => s.value && s.value !== "0" && s.value !== "No aplica");

  const mapQuery = encodeURIComponent(property.address);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-screen bg-white"
      >
        {/* Back bar */}
        <div className="border-b border-[#e5e5e5] bg-white sticky top-[72px] z-30">
          <div className="container-site flex items-center gap-4 h-12">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors"
            >
              <ArrowLeft size={14} />
              Volver
            </button>
            <div className="h-3.5 w-px bg-[#e5e5e5]" />
            <Badge variant={property.operation === "venta" ? "sale" : "rental"}>
              {operationLabel}
            </Badge>
          </div>
        </div>

        <div className="container-site py-10">

          {/* Top: image left + data right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">

            {/* Left: images */}
            <div>
              {/* Main image */}
              <div
                className="relative bg-[#f7f7f6] overflow-hidden cursor-zoom-in mb-3"
                style={{ aspectRatio: "16/10" }}
                onClick={() => { setLightboxIndex(thumbIndex); setLightboxOpen(true); }}
              >
                {images[thumbIndex] && (
                  <Image
                    src={images[thumbIndex]}
                    alt={property.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 65vw"
                    priority
                  />
                )}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 text-white text-[10px] font-semibold tracking-wide px-2 py-1">
                  <Maximize2 size={11} />
                  {images.length > 1 && <span>{thumbIndex + 1}/{images.length}</span>}
                </div>
              </div>

              {/* Carousel thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setThumbIndex(i)}
                      className={`relative w-20 h-14 flex-shrink-0 overflow-hidden transition-all ${
                        i === thumbIndex ? "ring-1 ring-[#0a0a0a]" : "opacity-50 hover:opacity-80"
                      }`}
                    >
                      <Image src={src} alt={`Foto ${i + 1}`} fill className="object-cover" sizes="80px" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: sidebar */}
            <div className="lg:sticky lg:top-[120px] h-fit">
              <div className="flex items-center gap-1.5 text-[11px] text-[#a3a3a3] tracking-wide mb-2">
                <MapPin size={11} />
                <span>{property.zone}</span>
              </div>

              <h1
                className="font-bold text-[#0a0a0a] leading-tight mb-4"
                style={{ fontSize: "clamp(1.4rem, 2.5vw, 2rem)", letterSpacing: "-0.04em" }}
              >
                {property.title}
              </h1>

              <div className="mb-6">
                <p className="font-bold text-[#0a0a0a] text-2xl" style={{ letterSpacing: "-0.03em" }}>
                  {formatMoney(property.price)}
                </p>
                {property.expenses && property.expenses !== "Consultar" && (
                  <p className="text-[#a3a3a3] text-xs mt-1">
                    Expensas: {formatMoney(property.expenses)}
                  </p>
                )}
              </div>

              {/* Specs */}
              <div className="border-t border-[#e5e5e5] mb-6">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between items-center py-3 border-b border-[#f0f0f0]">
                    <span className="text-[#a3a3a3] text-[11px] uppercase tracking-[0.08em] font-semibold">{spec.label}</span>
                    <span className="text-[#0a0a0a] font-medium text-[13px]">{spec.value}</span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="grid gap-3">
                <a
                  href={buildWhatsappLink(whatsappMessage)}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 h-12 bg-[#0a0a0a] text-white text-[11px] font-semibold tracking-[0.08em] uppercase hover:bg-[#1a1a1a] transition-colors"
                >
                  <MessageCircle size={15} />
                  Consultar por WhatsApp
                </a>
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 h-11 border border-[#e5e5e5] text-[#6b6b6b] text-[11px] font-semibold tracking-[0.08em] uppercase hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
                >
                  <Share2 size={13} />
                  Compartir propiedad
                </button>
              </div>
            </div>
          </div>

          {/* Description - full width */}
          {property.description && (
            <div className="mt-12 border-t border-[#e5e5e5] pt-10">
              <p className="section-kicker mb-4">Descripción</p>
              <p className="text-[#444] leading-[1.85] text-[15px] whitespace-pre-line max-w-3xl">
                {property.description}
              </p>
            </div>
          )}

          {/* Map - centered */}
          <div className="mt-12 border-t border-[#e5e5e5] pt-10">
            <p className="section-kicker mb-4 text-center">Ubicación</p>
            <p className="text-sm text-[#6b6b6b] mb-4 flex items-center justify-center gap-1.5">
              <MapPin size={13} />
              {property.address}
            </p>
            <div className="mx-auto max-w-3xl h-[320px] bg-[#f7f7f6] overflow-hidden relative">
              <iframe
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed&hl=es&z=16`}
                width="100%" height="100%"
                style={{ border: 0, filter: "grayscale(100%)" }}
                allowFullScreen loading="lazy"
                title="Ubicación de la propiedad"
                className="absolute inset-0"
              />
            </div>
          </div>

        </div>
      </motion.div>

      {lightboxOpen && (
        <PropertyLightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onNext={() => setLightboxIndex((i) => (i + 1) % images.length)}
          onPrev={() => setLightboxIndex((i) => (i - 1 + images.length) % images.length)}
          onSetIndex={setLightboxIndex}
        />
      )}
    </>
  );
}
