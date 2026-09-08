"use client";

/** Indicador fino de progreso arriba de todo, para cargas que tardan lo suficiente como para notarse. */
export function TopProgressBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-[2.5px] bg-[#e5e5e5]/40 overflow-hidden"
      role="progressbar"
      aria-label="Cargando"
      aria-valuetext="Cargando"
    >
      <div className="top-progress-bar h-full w-1/3 bg-[#0a0a0a]" />
    </div>
  );
}
