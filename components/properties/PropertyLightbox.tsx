"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxProps {
  images: string[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onSetIndex: (i: number) => void;
}

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;
const ZOOM_SCALE = 2.4;
const DOUBLE_TAP_MS = 300;

export function PropertyLightbox({
  images,
  index,
  open,
  onOpenChange,
  onNext,
  onPrev,
  onSetIndex,
}: LightboxProps) {
  const reduceMotion = useReducedMotion();
  const [zoomed, setZoomed] = useState(false);
  const lastTapRef = useRef(0);

  // El zoom se resetea cada vez que cambia de foto o se cierra la galería.
  useEffect(() => {
    setZoomed(false);
  }, [index, open]);

  const handleNext = useCallback(() => {
    setZoomed(false);
    onNext();
  }, [onNext]);

  const handlePrev = useCallback(() => {
    setZoomed(false);
    onPrev();
  }, [onPrev]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    },
    [handleNext, handlePrev]
  );

  // Precargar solo la foto anterior y la siguiente.
  useEffect(() => {
    if (!open || images.length < 2) return;
    const nextSrc = images[(index + 1) % images.length];
    const prevSrc = images[(index - 1 + images.length) % images.length];
    [nextSrc, prevSrc].forEach((src) => {
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    });
  }, [open, index, images]);

  const toggleZoom = useCallback(() => {
    setZoomed((z) => !z);
  }, []);

  const handleImageTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      toggleZoom();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [toggleZoom]);

  const handleDragEnd = useCallback(
    (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      if (zoomed) return; // en zoom, el drag solo desplaza (pan), no navega
      if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) {
        handleNext();
      } else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) {
        handlePrev();
      }
    },
    [zoomed, handleNext, handlePrev]
  );

  const transitionDuration = reduceMotion ? 0.01 : 0.2;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: transitionDuration }}
                className="fixed inset-0 z-[100] bg-black"
              />
            </Dialog.Overlay>

            <Dialog.Content
              asChild
              forceMount
              aria-label="Galería de fotos de la propiedad"
              onKeyDown={handleKeyDown}
              onOpenAutoFocus={(e) => {
                // El foco lo maneja Radix; evitamos que salte al primer botón
                // (el botón de cerrar) para que el lector de pantalla anuncie
                // primero el contenido de la galería.
                e.preventDefault();
                (e.currentTarget as HTMLElement)?.focus();
              }}
            >
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: transitionDuration, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[101] bg-black flex flex-col outline-none"
                style={{ height: "100dvh" }}
                tabIndex={-1}
              >
                <Dialog.Title className="sr-only">Galería de fotos</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Usá las flechas del teclado o deslizá para cambiar de foto. Presioná Escape para cerrar.
                </Dialog.Description>

                {/* Header */}
                <div
                  className="flex items-center justify-between flex-shrink-0 px-3"
                  style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
                >
                  <span className="text-white/60 text-[13px] font-medium tabular-nums px-2">
                    {images.length > 0 ? `${index + 1} / ${images.length}` : ""}
                  </span>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar galería"
                      className="w-11 h-11 flex items-center justify-center text-white/80 hover:text-white active:scale-[0.98] transition-all"
                    >
                      <X size={22} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Main image */}
                <div
                  className="flex-1 relative flex items-center justify-center min-h-0 select-none"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) onOpenChange(false);
                  }}
                >
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Foto anterior"
                      className="hidden sm:flex absolute left-2 w-11 h-11 items-center justify-center text-white/60 hover:text-white active:scale-[0.98] transition-all z-10"
                    >
                      <ChevronLeft size={26} />
                    </button>
                  )}

                  <div
                    className="relative w-full overflow-hidden touch-pan-y"
                    style={{ height: "100%", padding: "0 4px" }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={index}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: transitionDuration }}
                        className="absolute inset-0"
                      >
                        <motion.div
                          className="relative w-full h-full"
                          drag={zoomed ? true : "x"}
                          dragConstraints={zoomed ? { left: -160, right: 160, top: -160, bottom: 160 } : { left: 0, right: 0 }}
                          dragElastic={zoomed ? 0.4 : 0.85}
                          onDragEnd={handleDragEnd}
                          onClick={handleImageTap}
                          onDoubleClick={toggleZoom}
                          animate={{ scale: zoomed ? ZOOM_SCALE : 1 }}
                          transition={{ duration: transitionDuration }}
                          style={{ cursor: zoomed ? "grab" : "default" }}
                        >
                          {images[index] && (
                            <Image
                              src={images[index]}
                              alt={`Foto ${index + 1} de ${images.length}`}
                              fill
                              className="object-contain pointer-events-none"
                              sizes="100vw"
                              priority
                              draggable={false}
                            />
                          )}
                        </motion.div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Foto siguiente"
                      className="hidden sm:flex absolute right-2 w-11 h-11 items-center justify-center text-white/60 hover:text-white active:scale-[0.98] transition-all z-10"
                    >
                      <ChevronRight size={26} />
                    </button>
                  )}
                </div>

                {/* Thumbnails: ocultas en celular, visibles desde sm hacia arriba */}
                {images.length > 1 && (
                  <div
                    className="hidden sm:flex flex-shrink-0 px-4 py-3 gap-2 overflow-x-auto justify-center"
                    style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                  >
                    {images.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSetIndex(i)}
                        aria-label={`Ver foto ${i + 1}`}
                        aria-current={i === index}
                        className={`relative w-14 h-10 flex-shrink-0 overflow-hidden transition-opacity ${
                          i === index ? "opacity-100 ring-1 ring-white" : "opacity-40 hover:opacity-70"
                        }`}
                      >
                        <Image src={src} alt="" fill className="object-cover" sizes="56px" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
