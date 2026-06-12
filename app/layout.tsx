import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientShell } from "@/components/layout/ClientShell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Nivel Propiedades | Negocios Inmobiliarios en Ramos Mejía",
    template: "%s | Nivel Propiedades",
  },
  description:
    "Nivel Propiedades - Inmobiliaria en Ramos Mejía. Venta, alquiler, administración y tasaciones en Zona Oeste. Más de 46 años de trayectoria.",
  keywords: ["inmobiliaria", "Ramos Mejía", "propiedades", "venta", "alquiler", "Zona Oeste"],
  icons: { icon: "/favicon.png" },
  metadataBase: new URL("https://nivelpropiedades.com.ar"),
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Nivel Propiedades",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        {/* Runs before React — creates a full-screen overlay for direct property links
            so the pre-rendered home page is never visible during load */}
        <script dangerouslySetInnerHTML={{ __html: `
          if (/^\\/propiedad-/.test(window.location.pathname)) {
            var ol = document.createElement('div');
            ol.id = 'property-loader';
            ol.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;';
            ol.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="12" stroke="#e5e5e5" stroke-width="2"/><circle cx="14" cy="14" r="12" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-dasharray="20 56"><animateTransform attributeName="transform" type="rotate" from="0 14 14" to="360 14 14" dur="0.75s" repeatCount="indefinite"/></circle></svg><p style="margin:0;font-family:system-ui,sans-serif;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a3a3a3">Cargando propiedad</p>';
            document.body.appendChild(ol);
          }
        ` }} />
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
