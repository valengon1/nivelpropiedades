import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Configuration ────────────────────────────────────────────────────────────

const KITEPROP_BASE = "https://nivelpropiedades.kitepropcrm.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "property-images";
const BATCH_SIZE = 3;         // Propiedades en paralelo
const REQ_DELAY_MS = 700;     // Delay entre requests a KiteProp
const IMG_DELAY_MS = 150;     // Delay entre descargas de imágenes
const MAX_RETRIES = 3;
const MIN_IMAGE_BYTES = 5000; // Mínimo 5KB — filtra placeholders/blancos

// ─── Types ────────────────────────────────────────────────────────────────────

interface KiteProperty {
  kitepropId: string;
  sourceUrl: string;
  title: string;
  operation: "venta" | "alquiler";
  type: string;
  price: string;
  address: string;
  location: string;
  zone: string;
  rooms: number;
  meters: string;
  bathrooms: string;
  garage: string;
  expenses: string;
  description: string;
  kiteImages: string[];
}

interface DbProperty {
  id: string;
  kiteprop_id: string | null;
  source_url: string | null;
  title: string;
  operation: string;
  type: string;
  price: string;
  address: string;
  location: string;
  zone: string;
  rooms: number;
  meters: string;
  bathrooms: string;
  garage: string;
  expenses: string;
  description: string;
  image: string;
  images: string[];
  featured: boolean;
  publish_status: string;
  source_synced_at: string | null;
}

interface SyncResult {
  created: string[];
  updated: string[];
  archived: string[];
  unchanged: string[];
  imageUpdates: string[];
  errors: string[];
}

// ─── HTTP / Fetch Helpers ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, retries = MAX_RETRIES): Promise<string | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      const isLast = attempt === retries - 1;
      if (isLast) {
        console.error(`[SYNC] ✗ Error fetching ${url}: ${err}`);
        return null;
      }
      console.warn(`[SYNC] ↻ Retry ${attempt + 1}/${retries} — ${url}`);
      await sleep(REQ_DELAY_MS * (attempt + 1));
    }
  }
  return null;
}

// ─── KiteProp Scraper: Listing Pages ─────────────────────────────────────────

/**
 * Extrae todos los hrefs únicos que coinciden con el patrón de detalle de KiteProp.
 * Patrón: /site/properties/[ID_NUMERICO]/[slug-texto]
 */
function extractPropertyLinks(html: string): string[] {
  // Maneja tanto URLs absolutas como relativas:
  // href="https://nivelpropiedades.kitepropcrm.com/site/properties/517676/slug"
  // href="/site/properties/517676/slug"
  const pattern =
    /href="(?:https?:\/\/[^"\/]*)?\/site\/properties\/(\d+)\/([a-z0-9-]+)"/gi;
  const seen = new Set<string>();
  const links: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const id = m[1];
    const slug = m[2];
    const fullUrl = `${KITEPROP_BASE}/site/properties/${id}/${slug}`;
    if (slug.length > 0 && !seen.has(fullUrl)) {
      seen.add(fullUrl);
      links.push(fullUrl);
    }
  }
  return links;
}

function detectNextPage(html: string, currentPage: number): boolean {
  const next = currentPage + 1;
  return (
    html.includes(`page=${next}`) ||
    html.includes(`page%3D${next}`) ||
    new RegExp(`>\\s*${next}\\s*<`).test(html)
  );
}

async function getAllPropertyUrls(): Promise<Map<string, "venta" | "alquiler">> {
  const urlMap = new Map<string, "venta" | "alquiler">();

  // Secciones separadas — fuente de verdad para la operación (sale → venta, rental → alquiler)
  const sections: { url: string; op: "venta" | "alquiler"; opType: string }[] = [
    { url: `${KITEPROP_BASE}/site/properties/sale`, op: "venta", opType: "sale" },
    { url: `${KITEPROP_BASE}/site/properties/rental`, op: "alquiler", opType: "rental" },
  ];

  for (const section of sections) {
    let page = 1;
    let goNext = true;

    while (goNext && page <= 50) {
      const pageUrl = `${section.url}?opType=${section.opType}&page=${page}`;
      const html = await fetchHtml(pageUrl);

      if (!html) break;

      const links = extractPropertyLinks(html);
      if (links.length === 0) break;

      for (const link of links) {
        if (!urlMap.has(link)) urlMap.set(link, section.op);
      }

      goNext = detectNextPage(html, page);
      page++;
      await sleep(REQ_DELAY_MS);
    }
  }

  // Página principal como fallback para props no encontradas en las secciones
  const mainHtml = await fetchHtml(`${KITEPROP_BASE}/`);
  if (mainHtml) {
    for (const link of extractPropertyLinks(mainHtml)) {
      if (!urlMap.has(link)) {
        const slug = link.split("/").pop() ?? "";
        urlMap.set(link, slug.includes("alquiler") ? "alquiler" : "venta");
      }
    }
    await sleep(REQ_DELAY_MS);
  }

  console.log(`[SYNC] ✔ ${urlMap.size} URLs encontradas en KiteProp`);
  return urlMap;
}

// ─── KiteProp Scraper: Property Detail ───────────────────────────────────────

function parsePropertyType(title: string): string {
  const t = title.toUpperCase();
  if (t.includes("DEPARTAMENTO") || t.includes("DPTO")) return "Departamento";
  if (/\bPH\b/.test(t)) return "PH";
  if (t.includes("DUPLEX") || t.includes("DÚPLEX")) return "Departamento";
  if (t.includes("CASA")) return "Casa";
  if (t.includes("TERRENO")) return "Terreno";
  if (t.includes("LOTE")) return "Lote";
  if (t.includes("LOCAL") || t.includes("COMERCIAL")) return "Local";
  return "Departamento";
}

/**
 * Normaliza el precio al formato argentino:
 *   "ARS 300.000"     → "$ 300.000"   (formato AR, sin cambio)
 *   "ARS 67,000.00"   → "$ 67.000"    (formato US → AR)
 *   "USD 55.000"      → "USD 55.000"  (sin cambio)
 *   "USD 55,000.00"   → "USD 55.000"  (formato US → AR)
 */
function normalizePrice(rawPrice: string): string {
  const toArgentineFormat = (n: string): string => {
    // Si tiene coma → formato US (55,000.00). Tomar parte entera y pasar comas a puntos.
    if (n.includes(",")) return n.split(".")[0].replace(/,/g, ".");
    // Sin coma → ya en formato AR (300.000). Devolver tal cual.
    return n;
  };

  const usdMatch = rawPrice.match(/USD\s*([\d.,]+)/i);
  if (usdMatch) return `USD ${toArgentineFormat(usdMatch[1])}`;

  const arsMatch = rawPrice.match(/ARS\s*([\d.,]+)/i);
  if (arsMatch) return `$ ${toArgentineFormat(arsMatch[1])}`;

  return rawPrice.trim() || "Consultar";
}

/**
 * Extrae SOLO las imágenes /lg/ de static.kiteprop.com (alta resolución).
 * Filtra sm/ y md/ para evitar miniaturas.
 */
function extractLgImages(html: string): string[] {
  // Patrón: static.kiteprop.com/kp/properties/ID/HASH/lg/FILENAME.ext
  const pattern =
    /https:\/\/static\.kiteprop\.com\/kp\/properties\/\d+\/[a-f0-9]+\/lg\/[a-f0-9]+\.[a-z]+/gi;
  const seen = new Set<string>();
  const imgs: string[] = [];
  for (const m of html.matchAll(pattern)) {
    const url = m[0].split("?")[0]; // Quitar query params
    if (!seen.has(url)) {
      seen.add(url);
      imgs.push(url);
    }
  }

  // Fallback: si no hay /lg/, tomar /md/
  if (imgs.length === 0) {
    const mdPattern =
      /https:\/\/static\.kiteprop\.com\/kp\/properties\/\d+\/[a-f0-9]+\/md\/[a-f0-9]+\.[a-z]+/gi;
    for (const m of html.matchAll(mdPattern)) {
      const url = m[0].split("?")[0];
      if (!seen.has(url)) {
        seen.add(url);
        imgs.push(url);
      }
    }
  }

  return imgs;
}

/**
 * Extrae el texto visible del HTML (removiendo tags).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Like stripHtml but preserves paragraph/line breaks and decodes HTML entities.
// Used for description fields to keep the original formatting from KiteProp.
function stripHtmlBlock(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function scrapePropertyDetail(url: string, operation: "venta" | "alquiler"): Promise<KiteProperty | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  // KiteProp ID desde la URL
  const idMatch = url.match(/\/site\/properties\/(\d+)\//);
  if (!idMatch) return null;
  const kitepropId = idMatch[1];

  const text = stripHtml(html);

  // ── Título ──────────────────────────────────────────────────────────────────
  let title = "";
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) title = h1Match[1].trim();

  if (!title) {
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogTitle) title = ogTitle[1].trim();
  }

  if (!title) {
    const titleTag = html.match(/<title>([^<]+)<\/title>/i);
    if (titleTag) title = titleTag[1].replace(/ - KiteProp.*$/i, "").trim();
  }

  if (!title) title = `Propiedad KP${kitepropId}`;

  // ── Precio ───────────────────────────────────────────────────────────────────
  // KiteProp muestra: "ARS 300.000 - EN ALQUILER" o "USD 55.000 - EN VENTA"
  const priceRaw = text.match(/(ARS|USD|UYU|EUR)\s*[\d.,]+/i)?.[0] ?? "Consultar";
  const price = normalizePrice(priceRaw);

  // ── Tipo de propiedad ────────────────────────────────────────────────────────
  const type = parsePropertyType(title);

  // ── Ambientes ────────────────────────────────────────────────────────────────
  let rooms = 0;
  // Buscar en tabla de specs: "Ambientes 1" o "1 amb"
  const ambientesMatch =
    text.match(/Ambientes?\s*:?\s*(\d+)/i) ||
    text.match(/(\d+)\s*amb(?:ientes?)?/i) ||
    text.match(/(\d+)\s*amb\b/i);
  if (ambientesMatch) rooms = parseInt(ambientesMatch[1]);

  // ── Superficie ───────────────────────────────────────────────────────────────
  let meters = "";
  const metersMatch =
    text.match(/(?:Superficie total|Total Sq\.Meters|Sup\.?\s*total)\s*:?\s*([\d.,]+)\s*m/i) ||
    text.match(/([\d.,]+)\s*m[²2]/i);
  if (metersMatch) meters = `${metersMatch[1].replace(",", ".")} m²`;

  // ── Baños ────────────────────────────────────────────────────────────────────
  let bathrooms = "";
  const bathMatch =
    text.match(/Ba[ñn]os?\s*:?\s*(\d+)/i) ||
    text.match(/(\d+)\s*ba[ñn]os?/i);
  if (bathMatch) {
    const n = parseInt(bathMatch[1]);
    bathrooms = `${n} ${n === 1 ? "baño" : "baños"}`;
  }

  // ── Garage / Cochera ──────────────────────────────────────────────────────────
  let garage = "No posee";
  const garageMatch = text.match(/(\d+)\s*coch(?:era)?/i);
  if (garageMatch) {
    const n = parseInt(garageMatch[1]);
    garage = `${n} ${n === 1 ? "cochera" : "cocheras"}`;
  } else if (/coch(?:era)?/i.test(text)) {
    garage = "1 cochera";
  }

  // ── Expensas ─────────────────────────────────────────────────────────────────
  let expenses = "Sin expensas";
  const expMatch =
    text.match(/(?:Monthly Expenses|Expensas?\s*mensual(?:es)?)\s*:?\s*(ARS|USD)\s*([\d.,]+)/i) ||
    text.match(/Expensas?\s*:?\s*([\$ARS USD]+[\d.,]+)/i);
  if (expMatch) {
    const currency = expMatch[1]?.toUpperCase();
    const amount = expMatch[2] ?? expMatch[1];
    // Normalize to Argentine display format: strip non-numeric chars, remove decimal
    // then re-add thousands separators. Handles "320000.00", "320.000,00", "ars 320000.00", etc.
    const toArDisplay = (raw: string): string => {
      const digits = raw.replace(/[^\d.,]/g, "").replace(/[,.]\d{1,2}$/, "").replace(/[.,]/g, "");
      return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };
    if (currency === "USD") {
      expenses = `USD ${toArDisplay(amount)}`;
    } else {
      expenses = `$ ${toArDisplay(amount)}`;
    }
  } else if (/sin expensas/i.test(text)) {
    expenses = "Sin expensas";
  } else if (/consultar/i.test(text)) {
    expenses = "Consultar";
  }

  // ── Dirección ────────────────────────────────────────────────────────────────
  // KiteProp muestra la dirección en una tabla: <th>Ubicación</th><td>Calle 1234</td>
  let address = "";
  const ubicTd = html.match(/<th[^>]*>\s*Ubicaci[oó]n\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (ubicTd) {
    address = stripHtml(ubicTd[1]).trim().replace(/\s{2,}/g, " ");
  }

  // ── Ubicación / Barrio ────────────────────────────────────────────────────────
  const knownLocations = [
    "Ramos Mejía",
    "Haedo",
    "Villa Sarmiento",
    "Ciudadela",
    "Villa Luzuriaga",
    "Morón",
    "La Matanza",
    "Castelar",
    "Ituzaingó",
    "El Palomar",
    "Liniers",
    "Versalles",
    "Villa del Parque",
  ];
  let location = "";
  for (const loc of knownLocations) {
    if (text.includes(loc)) {
      location = loc;
      break;
    }
  }
  if (!location) {
    // Fallback desde URL slug
    const slugParts = url.split("/").pop()?.split("-") ?? [];
    if (slugParts.length > 2) {
      location = slugParts
        .slice(-2)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  // ── Zona ─────────────────────────────────────────────────────────────────────
  // KiteProp muestra zona justo después del título (ej: "Ramos norte")
  let zone = location;
  const zoneMatch = text.match(
    /(?:Ramos norte|Ramos sur|Ramos centro|centro|norte|sur|este|oeste)\b/i
  );
  if (zoneMatch) zone = zoneMatch[0].trim();
  if (zone === "" || zone === location) zone = `${location} Centro`;
  zone = zone.toUpperCase();

  // ── Descripción ───────────────────────────────────────────────────────────────
  let description = "";
  // Buscar el bloque de descripción (generalmente el párrafo más largo)
  const descMatch =
    html.match(/<div[^>]+class="[^"]*description[^"]*"[^>]*>([\s\S]+?)<\/div>/i) ||
    html.match(/<p[^>]*>([^<]{100,})<\/p>/i);
  if (descMatch) {
    description = stripHtmlBlock(descMatch[1]).trim();
  } else {
    // Fallback: párrafo más largo del texto visible
    const paras = text.split(/\n{2,}/).filter((p) => p.length > 80);
    if (paras.length > 0) {
      description = paras.reduce((a, b) => (a.length > b.length ? a : b), "").trim();
    }
  }

  // Limitar descripción a 2000 caracteres
  if (description.length > 2000) description = description.slice(0, 2000);

  // ── Imágenes ──────────────────────────────────────────────────────────────────
  const kiteImages = extractLgImages(html);

  return {
    kitepropId,
    sourceUrl: url,
    title,
    operation,
    type,
    price,
    address,
    location,
    zone,
    rooms,
    meters,
    bathrooms,
    garage,
    expenses,
    description,
    kiteImages,
  };
}

// ─── Image Processing ─────────────────────────────────────────────────────────

function normalizeImgUrl(url: string): string {
  return url.split("?")[0].split("#")[0].toLowerCase().trim();
}

/**
 * Compara dos arrays de imágenes (normalizados) para detectar cambios.
 * Retorna true si hay diferencias de cantidad, URLs o orden.
 */
function imagesChanged(kite: string[], db: string[]): boolean {
  if (kite.length !== db.length) return true;
  const kn = kite.map(normalizeImgUrl);
  const dn = db.map(normalizeImgUrl);
  return kn.some((u, i) => u !== dn[i]);
}

function getImgExtension(url: string): string {
  const m = url.match(/\.([a-z]{3,4})(?:\?|$)/i);
  return (m?.[1] ?? "jpg").toLowerCase();
}

function storagePath(kitepropId: string, index: number, ext: string): string {
  return `properties/kp-${kitepropId}-${String(index).padStart(3, "0")}.${ext}`;
}

async function downloadImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);

    if (bytes.length < MIN_IMAGE_BYTES) {
      console.warn(
        `[SYNC] ⚠ Imagen ignorada (${bytes.length}B, posible placeholder): ${url}`
      );
      return null;
    }

    // Validar header JPEG (FFD8FF) o PNG (89504E47)
    if (
      !(
        (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
        (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) // WEBP
      )
    ) {
      console.warn(`[SYNC] ⚠ Imagen ignorada (header inválido): ${url}`);
      return null;
    }

    return bytes;
  } catch (e) {
    console.warn(`[SYNC] ✗ No se pudo descargar imagen: ${url} — ${e}`);
    return null;
  }
}

/**
 * Sube imágenes de KiteProp a Supabase Storage.
 * Devuelve las URLs públicas de las imágenes subidas.
 * - Borra imágenes viejas del mismo kitepropId
 * - Solo sube imágenes válidas (>5KB, header JPEG/PNG/WebP)
 * - La portada = images[0], NO duplicada en el array
 */
async function uploadPropertyImages(
  supabase: ReturnType<typeof createClient>,
  kitepropId: string,
  kiteImages: string[],
  dry: boolean
): Promise<string[]> {
  const validUrls = kiteImages.filter(
    (u) => u.includes("static.kiteprop.com") && u.includes("/lg/")
  );

  if (validUrls.length === 0) return [];

  if (dry) {
    console.log(
      `[DRY] Subiría ${validUrls.length} imágenes para KP${kitepropId}`
    );
    return validUrls;
  }

  // Borrar imágenes viejas de este kiteprop_id
  try {
    // Listar todos los archivos de la carpeta y filtrar por prefijo del kitepropId
    const { data: allFiles } = await supabase.storage.from(STORAGE_BUCKET).list("properties");
    const oldFiles = allFiles?.filter((f: { name: string }) =>
      f.name.startsWith(`kp-${kitepropId}-`)
    ) ?? [];

    if (oldFiles && oldFiles.length > 0) {
      const paths = oldFiles.map((f: { name: string }) => `properties/${f.name}`);
      await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      console.log(
        `[SYNC] 🗑 ${paths.length} imágenes viejas eliminadas para KP${kitepropId}`
      );
    }
  } catch (e) {
    console.warn(`[SYNC] ⚠ No se pudieron borrar imágenes viejas: ${e}`);
  }

  const publicUrls: string[] = [];

  for (let i = 0; i < validUrls.length; i++) {
    await sleep(IMG_DELAY_MS);

    const imgUrl = validUrls[i];
    const ext = getImgExtension(imgUrl);
    const path = storagePath(kitepropId, i, ext);
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    const bytes = await downloadImageBytes(imgUrl);
    if (!bytes) continue;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000", // 1 año de caché
    });

    if (error) {
      console.error(`[SYNC] ✗ Error subiendo ${path}: ${error.message}`);
      continue;
    }

    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    if (pub?.publicUrl) {
      publicUrls.push(pub.publicUrl);
      console.log(
        `[SYNC] 🖼 Imagen ${i + 1}/${validUrls.length} subida → ${path}`
      );
    }
  }

  return publicUrls;
}

// ─── Database Operations ──────────────────────────────────────────────────────

async function getAllDbProperties(
  supabase: ReturnType<typeof createClient>
): Promise<DbProperty[]> {
  const { data, error } = await supabase.from("properties").select("*");
  if (error) throw new Error(`[SYNC] ✗ Error leyendo DB: ${error.message}`);
  return (data as DbProperty[]) ?? [];
}

/**
 * Busca la propiedad existente usando varias estrategias, en orden de confiabilidad.
 */
function findMatch(kite: KiteProperty, db: DbProperty[]): DbProperty | null {
  // 1. Por kiteprop_id (más confiable)
  const byId = db.find((p) => p.kiteprop_id === kite.kitepropId);
  if (byId) return byId;

  // 2. Por source_url
  const byUrl = db.find((p) => p.source_url === kite.sourceUrl);
  if (byUrl) return byUrl;

  // 3. Por título normalizado
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  const kiteNorm = norm(kite.title);
  const byTitle = db.find((p) => norm(p.title) === kiteNorm);
  if (byTitle) return byTitle;

  // 4. Por dirección + operación
  if (kite.address.length > 5) {
    const byAddr = db.find(
      (p) => p.address === kite.address && p.operation === kite.operation
    );
    if (byAddr) return byAddr;
  }

  return null;
}

function fieldChanged(label: string, a: unknown, b: unknown): boolean {
  const av = String(a ?? "").trim();
  const bv = String(b ?? "").trim();
  if (av !== bv) {
    console.log(`[SYNC]   ↳ '${label}': "${bv}" → "${av}"`);
    return true;
  }
  return false;
}

function hasChanges(kite: KiteProperty, db: DbProperty): boolean {
  const checks: [string, unknown, unknown][] = [
    ["title", kite.title, db.title],
    ["operation", kite.operation, db.operation],
    ["price", kite.price, db.price],
    ["address", kite.address, db.address],
    ["location", kite.location, db.location],
    ["rooms", kite.rooms, db.rooms],
    ["meters", kite.meters, db.meters],
    ["bathrooms", kite.bathrooms, db.bathrooms],
    ["expenses", kite.expenses, db.expenses],
    ["description", kite.description, db.description],
  ];

  let changed = false;
  for (const [label, a, b] of checks) {
    if (fieldChanged(label, a, b)) changed = true;
  }

  if (imagesChanged(kite.kiteImages, db.images ?? [])) {
    console.log(`[SYNC]   ↳ 'images': ${db.images?.length ?? 0} → ${kite.kiteImages.length} imágenes`);
    changed = true;
  }

  return changed;
}

function buildKeywords(kite: KiteProperty): string {
  return [
    kite.title,
    kite.type,
    kite.operation === "venta" ? "venta" : "alquiler",
    kite.location,
    kite.zone,
    kite.address,
    kite.rooms > 0 ? `${kite.rooms} ambientes` : "",
    kite.meters,
    kite.description.slice(0, 300),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s{2,}/g, " ");
}

function buildDetails(kite: KiteProperty): string[] {
  const d: string[] = [];
  if (kite.rooms > 0) d.push(`${kite.rooms} ${kite.rooms === 1 ? "ambiente" : "ambientes"}`);
  if (kite.meters) d.push(kite.meters);
  if (kite.bathrooms) d.push(kite.bathrooms);
  if (kite.garage && kite.garage !== "No posee") d.push(kite.garage);
  return d;
}

/**
 * Construye el payload para insertar/actualizar en Supabase.
 * La portada (image) = finalImages[0] — NUNCA duplicada.
 */
function buildPayload(
  kite: KiteProperty,
  finalImages: string[],
  keepStatus?: string
): Record<string, unknown> {
  const cover = finalImages[0] ?? "";
  return {
    title: kite.title,
    operation: kite.operation,
    type: kite.type,
    location: kite.location,
    zone: kite.zone,
    address: kite.address,
    rooms: kite.rooms,
    price: kite.price,
    expenses: kite.expenses,
    meters: kite.meters,
    bathrooms: kite.bathrooms,
    garage: kite.garage,
    description: kite.description,
    details: buildDetails(kite),
    keywords: buildKeywords(kite),
    image: cover,
    images: finalImages,
    kiteprop_id: kite.kitepropId,
    source_url: kite.sourceUrl,
    source_synced_at: new Date().toISOString(),
    publish_status: keepStatus ?? "Publicada",
  };
}

// ─── Main Sync ────────────────────────────────────────────────────────────────

async function syncAll(
  supabase: ReturnType<typeof createClient>,
  dry: boolean,
  uploadImages: boolean
): Promise<SyncResult> {
  const result: SyncResult = {
    created: [],
    updated: [],
    archived: [],
    unchanged: [],
    imageUpdates: [],
    errors: [],
  };

  // 1. Obtener todas las URLs de KiteProp (con operación ya conocida desde el listado)
  console.log("[SYNC] ▶ Leyendo propiedades de KiteProp...");
  const kiteUrlMap = await getAllPropertyUrls();
  if (kiteUrlMap.size === 0) {
    console.warn("[SYNC] ⚠ No se encontraron propiedades en KiteProp");
    return result;
  }

  // 2. Leer propiedades existentes en Supabase
  console.log("[SYNC] ▶ Leyendo propiedades de Supabase...");
  const dbProps = await getAllDbProperties(supabase);
  console.log(`[SYNC] ✔ ${dbProps.length} propiedades en DB | ${kiteUrlMap.size} en KiteProp`);

  // 3. Scrapear detalles de KiteProp (en batches para evitar timeout)
  console.log("[SYNC] ▶ Scrapeando detalles...");
  const kiteProps: KiteProperty[] = [];
  const processedIds = new Set<string>();
  const kiteEntries = Array.from(kiteUrlMap.entries());

  for (let i = 0; i < kiteEntries.length; i += BATCH_SIZE) {
    const batch = kiteEntries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(kiteEntries.length / BATCH_SIZE);
    console.log(`[SYNC] 📦 Batch ${batchNum}/${totalBatches} (${batch.length} props)`);

    const settled = await Promise.allSettled(
      batch.map(([u, op]) => scrapePropertyDetail(u, op))
    );

    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        kiteProps.push(r.value);
        processedIds.add(r.value.kitepropId);
      } else if (r.status === "rejected") {
        console.error(`[SYNC] ✗ Error en batch: ${r.reason}`);
      }
    }

    await sleep(REQ_DELAY_MS);
  }

  console.log(
    `[SYNC] ✔ ${kiteProps.length}/${kiteUrlMap.size} propiedades scrapeadas`
  );

  // 4. Procesar cada propiedad de KiteProp
  for (const kite of kiteProps) {
    const existing = findMatch(kite, dbProps);

    if (!existing) {
      // ── CREAR ──────────────────────────────────────────────────────────────
      console.log(`[SYNC] ✚ propiedad creada: "${kite.title}" (KP${kite.kitepropId})`);

      // Por defecto usa las URLs /lg/ de KiteProp CDN directamente (rápido).
      // Con ?uploadImages=1 las sube a Supabase Storage.
      let finalImages = kite.kiteImages;
      if (uploadImages && kite.kiteImages.length > 0) {
        const uploaded = await uploadPropertyImages(
          supabase,
          kite.kitepropId,
          kite.kiteImages,
          dry
        );
        if (uploaded.length > 0) {
          finalImages = uploaded;
          result.imageUpdates.push(kite.kitepropId);
        }
      }

      const payload = buildPayload(kite, finalImages);

      if (!dry) {
        const { error } = await supabase.from("properties").insert(payload);
        if (error) {
          console.error(`[SYNC] ✗ Error creando "${kite.title}": ${error.message}`);
          result.errors.push(`create:KP${kite.kitepropId}`);
          continue;
        }
      }

      result.created.push(`KP${kite.kitepropId}: ${kite.title}`);
    } else {
      // ── VERIFICAR CAMBIOS ──────────────────────────────────────────────────
      const changed = hasChanges(kite, existing);

      if (!changed) {
        // Sin cambios — solo actualizar campos de sync si faltan
        if (!existing.kiteprop_id || !existing.source_url) {
          if (!dry) {
            await supabase
              .from("properties")
              .update({
                kiteprop_id: kite.kitepropId,
                source_url: kite.sourceUrl,
                source_synced_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          }
        }
        console.log(`[SYNC] — sin cambios: "${kite.title}"`);
        result.unchanged.push(`KP${kite.kitepropId}: ${kite.title}`);
        continue;
      }

      // ── ACTUALIZAR ─────────────────────────────────────────────────────────
      console.log(`[SYNC] ✎ propiedad actualizada: "${kite.title}" (KP${kite.kitepropId})`);

      let finalImages = kite.kiteImages; // Siempre tomar las URLs actuales de KiteProp
      if (uploadImages && imagesChanged(kite.kiteImages, existing.images ?? [])) {
        const uploaded = await uploadPropertyImages(
          supabase,
          kite.kitepropId,
          kite.kiteImages,
          dry
        );
        if (uploaded.length > 0) {
          finalImages = uploaded;
          result.imageUpdates.push(kite.kitepropId);
          console.log(`[SYNC] 🖼 imágenes actualizadas: KP${kite.kitepropId}`);
        }
      } else if (imagesChanged(kite.kiteImages, existing.images ?? [])) {
        result.imageUpdates.push(kite.kitepropId);
        console.log(`[SYNC] 🖼 imágenes actualizadas (CDN): KP${kite.kitepropId}`);
      }

      // Preservar el status manual si fue seteado a algo específico (ej: Vendida, Reservada)
      const manualStatuses = ["Vendida", "Alquilada", "Reservada", "Borrador", "Pausada"];
      const keepStatus = manualStatuses.includes(existing.publish_status)
        ? existing.publish_status
        : "Publicada";

      const payload = buildPayload(kite, finalImages, keepStatus);

      if (!dry) {
        const { error } = await supabase
          .from("properties")
          .update(payload)
          .eq("id", existing.id);
        if (error) {
          console.error(`[SYNC] ✗ Error actualizando "${kite.title}": ${error.message}`);
          result.errors.push(`update:KP${kite.kitepropId}`);
          continue;
        }
      }

      result.updated.push(`KP${kite.kitepropId}: ${kite.title}`);
    }

    await sleep(200);
  }

  // 5. Archivar propiedades que ya no están en KiteProp
  const toArchive = dbProps.filter(
    (db) =>
      db.kiteprop_id &&
      !processedIds.has(db.kiteprop_id) &&
      db.publish_status !== "Archivada"
  );

  for (const db of toArchive) {
    console.log(
      `[SYNC] 📦 propiedad archivada: "${db.title}" (KP${db.kiteprop_id})`
    );

    if (!dry) {
      await supabase
        .from("properties")
        .update({
          publish_status: "Archivada",
          source_synced_at: new Date().toISOString(),
        })
        .eq("id", db.id);
    }

    result.archived.push(`KP${db.kiteprop_id}: ${db.title}`);
  }

  return result;
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  // Autenticación via Bearer token
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const uploadImages = url.searchParams.get("uploadImages") === "1";

  if (dry) console.log("[SYNC] 🔍 MODO DRY RUN — no se guardan cambios");
  if (uploadImages) console.log("[SYNC] 📤 Modo uploadImages — subiendo a Supabase Storage");
  else console.log("[SYNC] ⚡ Modo rápido — usando URLs CDN de KiteProp directamente");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const t0 = Date.now();

  try {
    const result = await syncAll(supabase, dry, uploadImages);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const summary = {
      ok: true,
      dry,
      timestamp: new Date().toISOString(),
      duration: `${elapsed}s`,
      stats: {
        created: result.created.length,
        updated: result.updated.length,
        archived: result.archived.length,
        unchanged: result.unchanged.length,
        imageUpdates: result.imageUpdates.length,
        errors: result.errors.length,
      },
      created: result.created,
      updated: result.updated,
      archived: result.archived,
      unchanged: result.unchanged,
      imageUpdates: result.imageUpdates,
      errors: result.errors,
    };

    console.log(
      `[SYNC] ✅ Completado en ${elapsed}s | ` +
        `+${result.created.length} creadas, ~${result.updated.length} actualizadas, ` +
        `📦 ${result.archived.length} archivadas, ` +
        `✗ ${result.errors.length} errores`
    );

    return new Response(JSON.stringify(summary, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`[SYNC] ✗ Error fatal (${elapsed}s):`, err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        duration: `${elapsed}s`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS },
      }
    );
  }
});
