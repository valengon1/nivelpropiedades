export interface Property {
  id: number | string;
  title: string;
  operation: "venta" | "alquiler";
  type: string;
  location: string;
  zone: string;
  address: string;
  rooms: number;
  price: string;
  expenses: string;
  meters: string;
  bathrooms: string;
  garage: string;
  highlight: string;
  details: string[];
  featured: boolean;
  image: string;
  images: string[];
  description: string;
  keywords: string;
  publishStatus?: string;
}

export interface PropertyFilters {
  keyword: string;
  type: string;
  location: string;
  rooms: string;
  operation: string;
}

export function mapDbRow(row: Record<string, unknown>): Property {
  return {
    id: row.id as number,
    title: (row.title as string) || "",
    operation: ((row.operation as string) || "venta") as "venta" | "alquiler",
    type: (row.type as string) || "Departamento",
    location: (row.location as string) || "",
    zone: (row.zone as string) || "",
    address: (row.address as string) || "",
    rooms: (row.rooms as number) || 0,
    price: (row.price as string) || "",
    expenses: (row.expenses as string) || "",
    meters: (row.meters as string) || "",
    bathrooms: (row.bathrooms as string) || "",
    garage: (row.garage as string) || "",
    highlight: (row.highlight as string) || "",
    details: (row.details as string[]) || [],
    featured: Boolean(row.featured),
    image: (row.image as string) || "",
    images: (row.images as string[]) || [],
    description: (row.description as string) || "",
    keywords: (row.keywords as string) || "",
    publishStatus: (row.publish_status as string) || "Publicada",
  };
}

export const DEFAULT_PROPERTIES: Property[] = [
  {
    id: 1,
    title: "Departamento con balcón y cochera",
    operation: "venta",
    type: "Departamento",
    location: "Ramos Mejía",
    zone: "Ramos Mejía Centro",
    address: "Av. de Mayo 325, Ramos Mejía, Buenos Aires, Argentina",
    rooms: 3,
    price: "USD 145.000",
    expenses: "$ 85.000",
    meters: "78 m²",
    bathrooms: "1 baño",
    garage: "1 cochera",
    highlight: "Balcón y cochera",
    details: ["3 ambientes", "78 m²", "Cochera"],
    featured: true,
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "Departamento cómodo y luminoso ubicado en una zona estratégica de Ramos Mejía Centro. Cuenta con buena distribución, balcón, cochera y ambientes funcionales. Ideal para quien busca vivir cerca de comercios, transporte y servicios principales.",
    keywords: "departamento balcon cochera ramos mejia centro",
  },
  {
    id: 2,
    title: "Casa familiar con jardín",
    operation: "venta",
    type: "Casa",
    location: "Haedo",
    zone: "Haedo Norte",
    address: "Caseros 1180, Haedo, Buenos Aires, Argentina",
    rooms: 4,
    price: "USD 210.000",
    expenses: "Sin expensas",
    meters: "170 m²",
    bathrooms: "2 baños",
    garage: "1 cochera",
    highlight: "Jardín propio",
    details: ["4 ambientes", "170 m²", "2 baños"],
    featured: true,
    image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "Casa familiar en Haedo Norte con jardín, cochera y espacios amplios. Propiedad pensada para una familia que busca comodidad, buena ubicación y posibilidad de adaptar los ambientes según sus necesidades.",
    keywords: "casa jardin cochera haedo norte",
  },
  {
    id: 3,
    title: "PH reciclado con terraza propia",
    operation: "venta",
    type: "PH",
    location: "Ramos Mejía",
    zone: "Ramos Mejía Sur",
    address: "Alvarado 640, Ramos Mejía, Buenos Aires, Argentina",
    rooms: 3,
    price: "USD 125.000",
    expenses: "Bajas expensas",
    meters: "86 m²",
    bathrooms: "1 baño",
    garage: "No posee",
    highlight: "Terraza propia",
    details: ["3 ambientes", "86 m²", "Terraza"],
    featured: true,
    image: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600607687644-c7171b42498b?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "PH reciclado con terraza propia, ambientes bien aprovechados y buena entrada de luz. Una opción práctica en Ramos Mejía Sur para quienes buscan independencia, espacio exterior y mantenimiento razonable.",
    keywords: "ph reciclado terraza ramos mejia sur",
  },
  {
    id: 4,
    title: "Lote para desarrollo residencial",
    operation: "venta",
    type: "Lote",
    location: "Villa Luzuriaga",
    zone: "Villa Luzuriaga",
    address: "Triunvirato 1850, Villa Luzuriaga, Buenos Aires, Argentina",
    rooms: 0,
    price: "USD 180.000",
    expenses: "Sin expensas",
    meters: "320 m²",
    bathrooms: "No aplica",
    garage: "No aplica",
    highlight: "Apto desarrollo",
    details: ["Lote", "320 m²", "Apto desarrollo"],
    featured: false,
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "Lote con potencial para proyecto residencial en Villa Luzuriaga. Buena superficie y ubicación interesante para desarrolladores o inversores que busquen una oportunidad en Zona Oeste.",
    keywords: "lote desarrollo villa luzuriaga terreno",
  },
  {
    id: 5,
    title: "Terreno sobre calle principal",
    operation: "venta",
    type: "Terreno",
    location: "Ciudadela",
    zone: "Ciudadela",
    address: "Rivadavia 12840, Ciudadela, Buenos Aires, Argentina",
    rooms: 0,
    price: "USD 95.000",
    expenses: "Sin expensas",
    meters: "240 m²",
    bathrooms: "No aplica",
    garage: "No aplica",
    highlight: "Buena ubicación",
    details: ["Terreno", "240 m²", "Buena ubicación"],
    featured: false,
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "Terreno ubicado sobre calle principal en Ciudadela. Oportunidad para inversión, construcción o desarrollo de proyecto propio. Consultar condiciones y documentación.",
    keywords: "terreno ciudadela lote calle principal",
  },
  {
    id: 6,
    title: "Departamento luminoso cerca del centro",
    operation: "alquiler",
    type: "Departamento",
    location: "Ramos Mejía",
    zone: "Ramos Mejía",
    address: "Belgrano 210, Ramos Mejía, Buenos Aires, Argentina",
    rooms: 2,
    price: "$ 480.000",
    expenses: "$ 60.000",
    meters: "48 m²",
    bathrooms: "1 baño",
    garage: "No posee",
    highlight: "Cerca del centro",
    details: ["2 ambientes", "48 m²", "Balcón"],
    featured: true,
    image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "Departamento luminoso de dos ambientes ubicado cerca del centro de Ramos Mejía. Ideal para quien busca buena conexión, comodidad diaria y cercanía a comercios y transporte.",
    keywords: "departamento alquiler luminoso ramos mejia balcon",
  },
  {
    id: 7,
    title: "PH cómodo con patio propio",
    operation: "alquiler",
    type: "PH",
    location: "Villa Sarmiento",
    zone: "Villa Sarmiento",
    address: "Castelli 740, Villa Sarmiento, Buenos Aires, Argentina",
    rooms: 3,
    price: "$ 620.000",
    expenses: "Sin expensas",
    meters: "92 m²",
    bathrooms: "1 baño",
    garage: "No posee",
    highlight: "Patio propio",
    details: ["3 ambientes", "92 m²", "Patio"],
    featured: true,
    image: "https://images.unsplash.com/photo-1600607687644-c7171b42498b?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1600607687644-c7171b42498b?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "PH en alquiler con patio propio en Villa Sarmiento. Cómodo, funcional y con espacio exterior, pensado para quienes valoran independencia y buena ubicación.",
    keywords: "ph alquiler patio villa sarmiento",
  },
  {
    id: 8,
    title: "Casa en alquiler con cochera",
    operation: "alquiler",
    type: "Casa",
    location: "Morón",
    zone: "Morón",
    address: "Buen Viaje 980, Morón, Buenos Aires, Argentina",
    rooms: 4,
    price: "$ 850.000",
    expenses: "Sin expensas",
    meters: "140 m²",
    bathrooms: "2 baños",
    garage: "1 cochera",
    highlight: "Cochera y patio",
    details: ["4 ambientes", "Cochera", "Patio"],
    featured: true,
    image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?q=80&w=1400&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "Casa en alquiler en Morón con cochera, patio y ambientes amplios. Una alternativa cómoda para familias que necesitan espacio y buena accesibilidad.",
    keywords: "casa alquiler moron cochera patio",
  },
  {
    id: 9,
    title: "Departamento monoambiente",
    operation: "alquiler",
    type: "Departamento",
    location: "Haedo",
    zone: "Haedo",
    address: "Fasola 560, Haedo, Buenos Aires, Argentina",
    rooms: 1,
    price: "$ 350.000",
    expenses: "$ 45.000",
    meters: "32 m²",
    bathrooms: "1 baño",
    garage: "No posee",
    highlight: "Bajas expensas",
    details: ["1 ambiente", "32 m²", "Contrafrente"],
    featured: false,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1200&auto=format&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=1400&auto=format&fit=crop",
    ],
    description:
      "Departamento monoambiente en Haedo, práctico y funcional. Ideal para una persona sola o primera vivienda en alquiler, con gastos moderados y buena ubicación.",
    keywords: "monoambiente departamento alquiler haedo",
  },
];
