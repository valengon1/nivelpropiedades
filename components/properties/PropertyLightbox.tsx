"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSetIndex: (i: number) => void;
}

export function PropertyLightbox({
  images,
  index,
  onClose,
  onNext,
  onPrev,
  onSetIndex,
}: LightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    },
    [onClose, onNext, onPrev]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <span className="text-white/50 text-sm font-medium">
            {index + 1} / {images.length}
          </span>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main image */}
        <div className="flex-1 relative flex items-center justify-center min-h-0 px-12">
          <button
            onClick={onPrev}
            className="absolute left-3 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors z-10"
          >
            <ChevronLeft size={28} />
          </button>

          <div className="relative w-full h-full max-w-5xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <Image
                  src={images[index]}
                  alt={`Foto ${index + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 80vw"
                  priority
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            onClick={onNext}
            className="absolute right-3 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors z-10"
          >
            <ChevronRight size={28} />
          </button>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex-shrink-0 px-5 py-4 flex gap-2 overflow-x-auto justify-center">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => onSetIndex(i)}
                className={`relative w-14 h-10 flex-shrink-0 overflow-hidden transition-opacity ${
                  i === index ? "opacity-100 ring-1 ring-white" : "opacity-40 hover:opacity-70"
                }`}
              >
                <Image
                  src={src}
                  alt={`Miniatura ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
