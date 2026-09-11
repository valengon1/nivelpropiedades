"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const navLinks = [
  { label: "Inicio", href: "/", op: null },
  { label: "Venta", href: "/venta", op: "venta" },
  { label: "Alquileres", href: "/alquileres", op: "alquiler" },
  { label: "Desarrolladores", href: "/desarrolladores", op: null },
  { label: "Sobre nosotros", href: "/nosotros", op: null },
  { label: "Contacto", href: "/contacto", op: null },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    if (pathname !== "/") setActiveOp(null);
  }, [pathname]);

  useEffect(() => {
    const onSearch = (e: Event) => setActiveOp((e as CustomEvent).detail?.op ?? null);
    const onHome = () => setActiveOp(null);
    window.addEventListener("nivel-quick-search", onSearch);
    window.addEventListener("nivel-go-home", onHome);
    return () => {
      window.removeEventListener("nivel-quick-search", onSearch);
      window.removeEventListener("nivel-go-home", onHome);
    };
  }, []);

  const isActive = (link: typeof navLinks[0]) => {
    if (link.op) return activeOp === link.op;
    if (link.href === "/") return pathname === "/" && !activeOp;
    return pathname.startsWith(link.href);
  };

  const handleClick = (link: typeof navLinks[0], e: React.MouseEvent) => {
    setMenuOpen(false);

    if (link.op) {
      if (pathname === "/") {
        // Ya en home: aplicar el filtro en caliente en vez de navegar
        // (el href sigue siendo correcto para clic derecho / abrir en pestaña).
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("nivel-quick-search", { detail: { op: link.op } })
        );
      }
      // En otra página: se deja la navegación normal del <Link> hacia
      // /?op=...#busqueda — al montar, la home lee el query y aplica el filtro.
      return;
    }

    // "Inicio" cuando ya estamos en home → resetear vista
    if (link.href === "/" && pathname === "/") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("nivel-go-home"));
    }
  };

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-white/95 backdrop-blur-sm border-b border-[#e5e5e5]"
            : "bg-white border-b border-[#e5e5e5]"
        )}
      >
        <div className="container-site">
          <nav className="flex items-center justify-between h-[72px]">
            <Link
              href="/"
              className="flex items-center flex-shrink-0"
              onClick={(e) => {
                setMenuOpen(false);
                if (pathname === "/") {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent("nivel-go-home"));
                }
              }}
            >
              <Image
                src="/logo-header.png"
                alt="Nivel Propiedades"
                width={140}
                height={40}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleClick(link, e)}
                  className={cn(
                    "text-[11px] font-semibold tracking-[0.1em] uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 rounded-sm",
                    isActive(link)
                      ? "text-[#0a0a0a]"
                      : "text-[#6b6b6b] hover:text-[#0a0a0a]"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden w-11 h-11 min-h-[44px] flex items-center justify-center text-[#0a0a0a] active:scale-[0.98] transition-all duration-150"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu-panel"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile menu */}
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <AnimatePresence>
          {menuOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
                  className="fixed inset-0 z-40 bg-black/20 lg:hidden"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount id="mobile-menu-panel">
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
                  className="fixed top-[72px] left-0 right-0 z-40 bg-white border-b border-[#e5e5e5] lg:hidden outline-none overflow-y-auto"
                  style={{ maxHeight: "calc(100dvh - 72px)" }}
                >
                  <Dialog.Title className="sr-only">Menú de navegación</Dialog.Title>
                  <div className="container-site py-4">
                    {navLinks.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        onClick={(e) => { handleClick(link, e); setMenuOpen(false); }}
                        className={cn(
                          "flex items-center py-4 min-h-[44px] text-[11px] font-semibold tracking-[0.1em] uppercase border-b border-[#f0f0f0] last:border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-inset",
                          isActive(link) ? "text-[#0a0a0a]" : "text-[#6b6b6b]"
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
