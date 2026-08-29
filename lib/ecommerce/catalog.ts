import type { Product } from "@/types/ecommerce";

export const CATALOG: Product[] = [
  {
    id: "noma-runner",
    name: "NOMA Runner",
    priceCents: 12900,
    sizes: ["8", "9", "10"],
    description: "Everyday running shoe with recycled knit upper.",
  },
  {
    id: "noma-drift",
    name: "NOMA Drift",
    priceCents: 9900,
    sizes: ["8", "9", "10"],
    description: "Lightweight trainer for daily walks.",
  },
  {
    id: "noma-trail",
    name: "NOMA Trail",
    priceCents: 14900,
    sizes: ["8", "9", "10"],
    description: "Grip-first trail shoe for wet terrain.",
  },
];

export function searchCatalog(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return CATALOG;
  return CATALOG.filter((product) =>
    product.name.toLowerCase().includes(q)
  );
}

export function findProduct(id: string): Product | undefined {
  return CATALOG.find((product) => product.id === id);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}