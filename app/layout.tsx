import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FloatingSocials } from "@/components/layout/FloatingSocials";

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
        <Header />
        <main className="pt-[72px]">{children}</main>
        <Footer />
        <FloatingSocials />
      </body>
    </html>
  );
}
