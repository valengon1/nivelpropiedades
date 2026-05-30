"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { label: "Inicio", href: "/", op: null },
  { label: "Venta", href: "/", op: "venta" },
  { label: "Alquileres", href: "/", op: "alquiler" },
  { label: "Desarrolladores", href: "/desarrolladores", op: null },
  { label: "Sobre nosotros", href: "/nosotros", op: null },
  { label: "Contacto", href: "/contacto", op: null },
];

export function Footer() {
  const pathname = usePathname();

  const handleClick = (link: typeof footerLinks[0], e: React.MouseEvent) => {
    if (link.op) {
      e.preventDefault();
      if (pathname !== "/") {
        window.location.href = `/?op=${link.op}`;
      } else {
        window.dispatchEvent(new CustomEvent("nivel-quick-search", { detail: { op: link.op } }));
      }
    } else if (link.href === "/" && pathname === "/") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("nivel-go-home"));
    }
  };
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0a0a] text-white">
      <div className="container-site py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-white/30 mb-4">
              Nivel Propiedades
            </p>
            <p className="text-[#888] text-sm leading-relaxed max-w-xs">
              Negocios Inmobiliarios en Ramos Mejía. Venta, alquiler y administración de propiedades en Zona Oeste.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-white/30 mb-4">
              Secciones
            </p>
            <div className="grid gap-2">
              {footerLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleClick(link, e)}
                  className="text-[#888] text-sm hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-white/30 mb-4">
              Contacto
            </p>
            <div className="grid gap-2">
              <p className="text-[#888] text-sm">Av. Gaona 2422, Ramos Mejía</p>
              <a
                href="tel:+541146540122"
                className="text-[#888] text-sm hover:text-white transition-colors"
              >
                4654-0122
              </a>
              <a
                href="https://wa.me/5491166838275"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#888] text-sm hover:text-white transition-colors"
              >
                11 6683-8275
              </a>
              <a
                href="mailto:nivelconsultas@gmail.com"
                className="text-[#888] text-sm hover:text-white transition-colors"
              >
                nivelconsultas@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between gap-3">
          <span className="text-[#555] text-xs">
            © {year} Nivel Propiedades. Todos los derechos reservados.
          </span>
          <span className="text-[#555] text-xs">Negocios Inmobiliarios</span>
        </div>
      </div>
    </footer>
  );
}
