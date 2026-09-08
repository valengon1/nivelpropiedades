"use client";

import { useCallback, useRef, useState } from "react";

export function useToast(duration = 2800) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), duration);
    },
    [duration]
  );

  return { message, visible, show };
}

interface ToastProps {
  message: string;
  visible: boolean;
}

/** Toast accesible: aria-live para que lectores de pantalla lo anuncien, desaparece solo. */
export function Toast({ message, visible }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 z-[200] transition-all duration-200 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="bg-[#0a0a0a] text-white text-[13px] font-medium px-5 py-3 shadow-lg whitespace-nowrap">
        {message}
      </div>
    </div>
  );
}
