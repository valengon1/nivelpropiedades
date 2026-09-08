/** Mismas proporciones que PropertyCard, para que no haya salto de layout al reemplazarlo. */
export function PropertyCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden="true">
      <div className="aspect-[4/3] bg-[#f0f0f0] animate-pulse" />
      <div className="pt-4">
        <div className="h-2.5 bg-[#f0f0f0] animate-pulse w-1/3 rounded mb-2.5" />
        <div className="h-4 bg-[#f0f0f0] animate-pulse w-4/5 rounded mb-2" />
        <div className="h-4 bg-[#f0f0f0] animate-pulse w-2/5 rounded mb-3" />
        <div className="h-3 bg-[#f0f0f0] animate-pulse w-1/2 rounded mb-4" />
      </div>
      <div className="mt-auto flex gap-2 pt-2 border-t border-[#f0f0f0]">
        <div className="flex-1 h-10 bg-[#f0f0f0] animate-pulse" />
        <div className="flex-1 h-10 bg-[#f0f0f0] animate-pulse" />
      </div>
    </div>
  );
}
