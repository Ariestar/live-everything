import type { DetectionResult } from '../types/detection';
import type { LabelEntry, LabelMap, Product } from '../types/product';
import { CONFIG } from '../config';

/** 把一条检测映射到定制商品（未命中定制则返回 null） */
export function matchDetectionToProduct(
  detection: DetectionResult,
  labelMap: LabelMap,
  products: Product[]
): Product | null {
  if (detection.confidence < CONFIG.minConfidence) return null;
  const entry = labelMapEntryFor(detection, labelMap);
  if (!entry?.custom_product_id) return null;
  return (
    products.find(
      (p) => p.product_id === entry.custom_product_id && p.status === 'active'
    ) ?? null
  );
}

/** 查 label_mapping：优先用数字 id（与 `id2label` 键一致），fallback 到英文 */
export function labelMapEntryFor(
  d: DetectionResult,
  labelMap: LabelMap
): LabelEntry | undefined {
  if (d.classIdNum !== undefined) {
    const byId = labelMap[String(d.classIdNum)];
    if (byId) return byId;
  }
  if (d.classId) {
    return Object.values(labelMap).find((e) => e.en === d.classId);
  }
  return undefined;
}

/**
 * 主目标挑选策略：
 * 1. 优先选**能匹配到定制商品**的检测中置信度最高者（突出 SKU 交互）；
 * 2. 若没有任何定制命中，就退回到置信度最高的通用目标；
 * 3. 低于 `minConfidence` 的一律忽略，避免噪声主导 UI。
 */
export function pickPrimaryDetection(
  detections: DetectionResult[],
  labelMap: LabelMap,
  products: Product[]
): DetectionResult | null {
  const pool = detections.filter((d) => d.confidence >= CONFIG.minConfidence);
  if (pool.length === 0) return null;

  const matched = pool.filter((d) =>
    matchDetectionToProduct(d, labelMap, products)
  );
  const source = matched.length > 0 ? matched : pool;
  return source.reduce((best, d) => (d.confidence > best.confidence ? d : best));
}
