"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FloatingSocials } from "./FloatingSocials";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/ficha")) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="pt-[72px]">{children}</main>
      <Footer />
      <FloatingSocials />
    </>
  );
}
