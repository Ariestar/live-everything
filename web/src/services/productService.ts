import type { LabelEntry, LabelMap, Product } from '../types/product';
import { CONFIG } from '../config';

let labelMapCache: LabelMap | null = null;
let productsCache: Product[] | null = null;

/** 归一化单条 label 避免因缺字段导致后续代码崩 */
function normalizeLabel(raw: unknown, fallbackId: string): LabelEntry {
  const obj = (raw ?? {}) as Partial<LabelEntry>;
  return {
    en: obj.en ?? fallbackId,
    zh: obj.zh ?? fallbackId,
    baike_query: obj.baike_query,
    semantic_category_id: obj.semantic_category_id,
    custom_product_id: obj.custom_product_id ?? null,
  };
}

/** 把松散的 product JSON 归一化成前端可放心消费的结构 */
function normalizeProduct(raw: unknown): Product | null {
  const r = raw as Partial<Product> | undefined;
  if (!r?.product_id || !r.product_name) return null;
  return {
    product_id: r.product_id,
    product_name: r.product_name,
    category_id: r.category_id,
    semantic_category_id: r.semantic_category_id,
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
    tagline: r.tagline ?? '',
    one_line_hook: r.one_line_hook,
    self_intro_short: r.self_intro_short,
    self_intro_medium: r.self_intro_medium,
    story_monologue_90s: r.story_monologue_90s,
    visual_identity: r.visual_identity,
    core_values: Array.isArray(r.core_values) ? r.core_values : [],
    selling_points: Array.isArray(r.selling_points) ? r.selling_points : [],
    specs: Array.isArray(r.specs) ? r.specs : [],
    audience: Array.isArray(r.audience) ? r.audience : [],
    use_cases: Array.isArray(r.use_cases) ? r.use_cases : [],
    guided_demo_script: Array.isArray(r.guided_demo_script) ? r.guided_demo_script : [],
    limitations: r.limitations,
    care_tips: r.care_tips,
    common_misunderstandings: r.common_misunderstandings,
    question_type_answers: r.question_type_answers,
    follow_up_questions: r.follow_up_questions,
    faq: Array.isArray(r.faq) ? r.faq : [],
    qr_code_asset: r.qr_code_asset,
    cover_image: r.cover_image,
    status: (r.status as Product['status']) ?? 'active',
  };
}

export async function loadLabelMap(): Promise<LabelMap> {
  if (labelMapCache) return labelMapCache;
  try {
    const res = await fetch(`${CONFIG.knowledgeBasePath}config/label_mapping.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { labels?: Record<string, unknown> };
    const out: LabelMap = {};
    for (const [k, v] of Object.entries(json.labels ?? {})) {
      out[k] = normalizeLabel(v, k);
    }
    labelMapCache = out;
    return out;
  } catch (e) {
    console.error('[productService] 加载 label_mapping 失败:', e);
    return (labelMapCache = {});
  }
}

/**
 * 并发拉取所有定制商品 JSON。商品清单由 label_map 里不为 null 的
 * `custom_product_id` 去重得到，因此**新增商品无需改前端代码**：
 * 在 `data/knowledge-base/config/label_mapping.json` 里填上 id，
 * 再把对应 `products/custom/<id>.json` 放进去即可。
 */
export async function loadProducts(labelMap: LabelMap): Promise<Product[]> {
  if (productsCache) return productsCache;
  const ids = new Set<string>();
  for (const entry of Object.values(labelMap)) {
    if (entry.custom_product_id) ids.add(entry.custom_product_id);
  }
  const results = await Promise.all(
    [...ids].map(async (id) => {
      try {
        const r = await fetch(`${CONFIG.knowledgeBasePath}products/custom/${id}.json`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return normalizeProduct(await r.json());
      } catch (e) {
        console.warn(`[productService] 加载商品 ${id} 失败:`, e);
        return null;
      }
    })
  );
  productsCache = results.filter(
    (p): p is Product => !!p && p.status === 'active'
  );
  return productsCache;
}

export function getProductById(
  products: Product[],
  productId: string
): Product | undefined {
  return products.find((p) => p.product_id === productId);
}

export function invalidateCache(): void {
  labelMapCache = null;
  productsCache = null;
}
