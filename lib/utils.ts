import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: string | undefined): string {
  const clean = String(value || "").trim();
  if (!clean) return "Consultar";
  if (clean === "Sin expensas" || clean === "Consultar") return clean;

  const stripped = clean.replace(/[,.]\d{1,2}$/, "").replace(/\D/g, "");
  const formatted = stripped.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (clean.startsWith("USD")) return `USD ${formatted}`;
  if (clean.startsWith("$")) return `$ ${formatted}`;

  return clean;
}

export function buildWhatsappLink(message: string, number = "5491166838275"): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function matchesRooms(propertyRooms: number, selected: string): boolean {
  if (selected === "all") return true;
  if (selected === "5") return propertyRooms >= 5;
  return propertyRooms === Number(selected);
}
