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
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
