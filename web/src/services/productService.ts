import { Product, ClassMapping } from '../types/product';
import { CONFIG } from '../config';

let productsCache: Product[] | null = null;
let mappingsCache: ClassMapping[] | null = null;

export async function loadProducts(): Promise<Product[]> {
  if (productsCache) return productsCache;
  try {
    const res = await fetch(CONFIG.productsPath);
    const data: Product[] = await res.json();
    productsCache = data.filter((p) => p.status === 'active');
    return productsCache;
  } catch (e) {
    console.error('[productService] Failed to load products:', e);
    return [];
  }
}

export async function loadClassMappings(): Promise<ClassMapping[]> {
  if (mappingsCache) return mappingsCache;
  try {
    const res = await fetch(CONFIG.classMappingsPath);
    mappingsCache = await res.json();
    return mappingsCache!;
  } catch (e) {
    console.error('[productService] Failed to load class mappings:', e);
    return [];
  }
}

export function getProductById(
  products: Product[],
  productId: string
): Product | undefined {
  return products.find((p) => p.product_id === productId);
}

export function invalidateCache(): void {
  productsCache = null;
  mappingsCache = null;
}
