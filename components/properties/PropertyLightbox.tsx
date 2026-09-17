"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  animate,
  type PanInfo,
} from "framer-motion";
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
const DOUBLE_TAP_SCALE = 2.4;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;
const PAN_BOUND = 220; // límite fijo y generoso para el pan en zoom — simple y suficiente

function touchDistance(touches: React.TouchList | TouchList): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

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
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchCount, setTouchCount] = useState(0);
  const lastTapRef = useRef(0);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  // Motion values propias (no React state) para que el pinch pueda actualizar
  // el zoom en cada frame de touchmove sin pasar por un re-render de React.
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const resetZoom = useCallback(
    (animated = true) => {
      if (animated && !reduceMotion) {
        animate(scale, 1, { duration: 0.2 });
        animate(x, 0, { duration: 0.2 });
        animate(y, 0, { duration: 0.2 });
      } else {
        scale.set(1);
        x.set(0);
        y.set(0);
      }
      setIsZoomed(false);
    },
    [scale, x, y, reduceMotion]
  );

  // El zoom se resetea cada vez que cambia de foto o se cierra la galería.
  useEffect(() => {
    resetZoom(false);
    setTouchCount(0);
    pinchRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open]);

  const handleNext = useCallback(() => {
    resetZoom(false);
    onNext();
  }, [onNext, resetZoom]);

  const handlePrev = useCallback(() => {
    resetZoom(false);
    onPrev();
  }, [onPrev, resetZoom]);

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

  const toggleDoubleTapZoom = useCallback(() => {
    if (isZoomed) {
      resetZoom();
    } else {
      if (!reduceMotion) animate(scale, DOUBLE_TAP_SCALE, { duration: 0.2 });
      else scale.set(DOUBLE_TAP_SCALE);
      setIsZoomed(true);
    }
  }, [isZoomed, resetZoom, scale, reduceMotion]);

  const handleImageTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      toggleDoubleTapZoom();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [toggleDoubleTapZoom]);

  // ── Pinch-to-zoom ────────────────────────────────────────────────────────
  // Framer-motion no trae reconocedor de pinch: se sigue "a mano" con los
  // eventos táctiles nativos, escalando `scale` en cada movimiento mientras
  // haya 2 dedos en pantalla.
  //
  // El listener de touchmove se agrega con addEventListener en vez de
  // onTouchMove de React por dos motivos: (1) React marca sus listeners de
  // touch como passive por default, así que e.preventDefault() no tendría
  // efecto real (el navegador igual intentaría zoomear/scrollear la
  // página); y (2) se engancha desde un ref callback en vez de un
  // useEffect — con este modal (Radix Portal + AnimatePresence, montado
  // recién cuando `open` pasa a true) un useEffect corriendo por cambios de
  // `open` seguía viendo el ref en null la primera vez que abría. El ref
  // callback no tiene ese problema: React lo llama con el nodo real justo
  // cuando se monta.
  const pinchContainerRef = useRef<HTMLDivElement | null>(null);

  const onNativeTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = touchDistance(e.touches);
        const ratio = dist / pinchRef.current.startDist;
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchRef.current.startScale * ratio));
        scale.set(next);
        setIsZoomed(next > 1.05);
      }
    },
    [scale]
  );

  const setPinchContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (pinchContainerRef.current) {
        pinchContainerRef.current.removeEventListener("touchmove", onNativeTouchMove);
      }
      pinchContainerRef.current = node;
      if (node) {
        node.addEventListener("touchmove", onNativeTouchMove, { passive: false });
      }
    },
    [onNativeTouchMove]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setTouchCount(e.touches.length);
      if (e.touches.length === 2) {
        pinchRef.current = {
          startDist: touchDistance(e.touches),
          startScale: scale.get(),
        };
      }
    },
    [scale]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      setTouchCount(e.touches.length);
      if (e.touches.length < 2) {
        pinchRef.current = null;
        if (scale.get() < 1.05) {
          resetZoom();
        }
      }
    },
    [scale, resetZoom]
  );

  const handleDragEnd = useCallback(
    (_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
      if (isZoomed) return; // en zoom, el drag solo desplaza (pan), no navega
      if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) {
        handleNext();
      } else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) {
        handlePrev();
      }
    },
    [isZoomed, handleNext, handlePrev]
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
                  Usá las flechas del teclado o deslizá para cambiar de foto. Pellizcá con dos
                  dedos o tocá dos veces para hacer zoom. Presioná Escape para cerrar.
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
                    ref={setPinchContainerRef}
                    className="relative w-full overflow-hidden touch-none"
                    style={{ height: "100%", padding: "0 4px" }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={index}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: transitionDuration }}
                        className="absolute inset-0"
                      >
                        <motion.div
                          data-testid="zoomable-image"
                          className="relative w-full h-full"
                          drag={touchCount >= 2 ? false : isZoomed ? true : "x"}
                          dragConstraints={
                            isZoomed
                              ? { left: -PAN_BOUND, right: PAN_BOUND, top: -PAN_BOUND, bottom: PAN_BOUND }
                              : { left: 0, right: 0 }
                          }
                          dragElastic={isZoomed ? 0.15 : 0.85}
                          onDragEnd={handleDragEnd}
                          onClick={handleImageTap}
                          onDoubleClick={toggleDoubleTapZoom}
                          style={{ cursor: isZoomed ? "grab" : "default", scale, x, y }}
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
