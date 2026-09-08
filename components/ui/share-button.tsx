"use client";

import { Share2 } from "lucide-react";
import { useToast, Toast } from "@/components/ui/toast";

interface ShareButtonProps {
  title: string;
  /** URL pública y directa a compartir — siempre absoluta, sin parámetros temporales. */
  url: string;
  className?: string;
  label?: string;
}

const DEFAULT_CLASS =
  "flex items-center justify-center gap-2 h-11 min-h-[44px] border border-[#e5e5e5] text-[#6b6b6b] text-[11px] font-semibold tracking-[0.08em] uppercase hover:border-[#0a0a0a] hover:text-[#0a0a0a] active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2";

export function ShareButton({ title, url, className, label = "Compartir propiedad" }: ShareButtonProps) {
  const { message, visible, show } = useToast();

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // El usuario canceló la hoja de compartir del sistema: no es un error.
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      show("Enlace copiado");
    } catch {
      show("No se pudo copiar el enlace");
    }
  };

  return (
    <>
      <button type="button" onClick={handleShare} className={className ?? DEFAULT_CLASS}>
        <Share2 size={13} />
        {label}
      </button>
      <Toast message={message} visible={visible} />
    </>
  );
}
