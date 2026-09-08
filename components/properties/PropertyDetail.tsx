"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, MessageCircle, Maximize2 } from "lucide-react";
import { type Property } from "@/types/property";
import { formatMoney, buildWhatsappLink, getPropertyPath } from "@/lib/utils";
import { PropertyLightbox } from "@/components/properties/PropertyLightbox";
import { Badge } from "@/components/ui/badge";
import { ShareButton } from "@/components/ui/share-button";

interface PropertyDetailProps {
  property: Property;
  onBack: () => void;
}

export function PropertyDetail({ property, onBack }: PropertyDetailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [thumbIndex, setThumbIndex] = useState(0);
  const lightboxTriggerRef = useRef<HTMLButtonElement>(null);

  const openLightbox = (i: number) => {
    setLightboxIndex(i);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    // Devolver el foco a la imagen que abrió la galería.
    requestAnimationFrame(() => lightboxTriggerRef.current?.focus());
  };

  // Marca el <body> mientras la ficha está montada, para que la burbuja
  // flotante de WhatsApp (global, ver FloatingSocials) se oculte en celular
  // y no duplique la barra fija de WhatsApp de acá abajo.
  useEffect(() => {
    document.body.setAttribute("data-property-detail", "1");
    return () => document.body.removeAttribute("data-property-detail");
  }, []);

  const images =
    property.images?.length
      ? property.images
      : [property.image].filter(Boolean) as string[];

  const operationLabel = property.operation === "venta" ? "Venta" : "Alquiler";

  const whatsappMessage =
    `Hola Nivel Propiedades, quiero consultar por esta propiedad: ${property.title}. ` +
    `Dirección: ${property.address}. Operación: ${operationLabel}. ` +
    `Precio: ${formatMoney(property.price)}.`;

  // URL pública canónica de la propiedad — siempre la misma, sin importar
  // desde qué búsqueda/filtro se llegó a esta ficha.
  const canonicalUrl =
    typeof window !== "undefined" ? `${window.location.origin}${getPropertyPath(property.id)}` : "";

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

  // Preferir las coordenadas exactas (vienen del propio KiteProp, que ya las
  // tiene geocodificadas). Sin coordenadas, geocodificar texto es ambiguo —
  // ej. "Merlo" es a la vez una calle en Castelar y una ciudad/partido a
  // 30km— así que ese caso queda como respaldo agregando barrio y provincia.
  const hasCoords = typeof property.lat === "number" && typeof property.lng === "number";
  const fullAddress = [property.address, property.location, "Buenos Aires, Argentina"]
    .filter(Boolean)
    .join(", ");
  const mapQuery = hasCoords
    ? `${property.lat},${property.lng}`
    : encodeURIComponent(fullAddress);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-screen bg-white pb-24 lg:pb-0"
      >
        {/* Back bar */}
        <div className="border-b border-[#e5e5e5] bg-white sticky top-[72px] z-30">
          <div className="container-site flex items-center gap-4 h-12">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6b6b6b] hover:text-[#0a0a0a] active:scale-[0.98] transition-all duration-150 -ml-1 pl-1 pr-2 py-1 min-h-[44px]"
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

        <div className="container-site py-6 lg:py-10">

          {/* Top: image left + data right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-10 items-start">

            {/* Left: images */}
            <div className="min-w-0 overflow-hidden">
              {/* Main image */}
              <button
                type="button"
                ref={lightboxTriggerRef}
                className="relative w-full bg-[#f7f7f6] overflow-hidden cursor-zoom-in mb-3 block text-left"
                style={{ aspectRatio: "16/10", maxHeight: "65vh" }}
                onClick={() => openLightbox(thumbIndex)}
                aria-label={`Ampliar foto ${thumbIndex + 1} de ${images.length}`}
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
              </button>

              {/* Carousel thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setThumbIndex(i)}
                      className={`relative w-20 h-16 flex-shrink-0 overflow-hidden transition-all ${
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
                className="font-bold text-[#0a0a0a] leading-tight mb-4 text-2xl lg:text-[clamp(1.4rem,2.5vw,2rem)]"
                style={{ letterSpacing: "-0.04em" }}
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

              {/* CTAs — el de WhatsApp se repite fijo abajo en celular, así que acá queda solo para desktop */}
              <div className="grid gap-3">
                <a
                  href={buildWhatsappLink(whatsappMessage)}
                  target="_blank" rel="noopener noreferrer"
                  className="hidden lg:flex items-center justify-center gap-2 h-12 min-h-[44px] bg-[#0a0a0a] text-white text-[11px] font-semibold tracking-[0.08em] uppercase hover:bg-[#1a1a1a] active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                  <MessageCircle size={15} />
                  Consultar por WhatsApp
                </a>
                <ShareButton title={property.title} url={canonicalUrl} />
              </div>
            </div>
          </div>

          {/* Description - full width */}
          {property.description && (
            <div className="mt-8 lg:mt-12 border-t border-[#e5e5e5] pt-8 lg:pt-10">
              <p className="section-kicker mb-4">Descripción</p>
              <p className="text-[#444] leading-[1.85] text-[15px] whitespace-pre-line max-w-3xl">
                {property.description}
              </p>
            </div>
          )}

          {/* Map - centered */}
          <div className="mt-8 lg:mt-12 border-t border-[#e5e5e5] pt-8 lg:pt-10">
            <p className="section-kicker mb-4 text-center">Ubicación</p>
            <p className="text-sm text-[#6b6b6b] mb-4 flex items-center justify-center gap-1.5">
              <MapPin size={13} />
              {[property.address, property.location].filter(Boolean).join(", ")}
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

      {/* Barra fija de WhatsApp en celular — no tapa contenido gracias al pb-24 del wrapper */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e5e5e5] px-4 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <a
          href={buildWhatsappLink(whatsappMessage)}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-12 min-h-[44px] bg-[#0a0a0a] text-white text-[11px] font-semibold tracking-[0.08em] uppercase active:scale-[0.98] transition-all duration-150"
        >
          <MessageCircle size={15} />
          Consultar por WhatsApp
        </a>
      </div>

      <PropertyLightbox
        images={images}
        index={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={(o) => (o ? setLightboxOpen(true) : closeLightbox())}
        onNext={() => setLightboxIndex((i) => (i + 1) % images.length)}
        onPrev={() => setLightboxIndex((i) => (i - 1 + images.length) % images.length)}
        onSetIndex={setLightboxIndex}
      />
    </>
  );
}
