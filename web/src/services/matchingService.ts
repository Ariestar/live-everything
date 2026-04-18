import { DetectionResult } from '../types/detection';
import { ClassMapping, Product } from '../types/product';
import { CONFIG } from '../config';

export function matchDetectionToProduct(
  detection: DetectionResult,
  mappings: ClassMapping[],
  products: Product[]
): Product | null {
  const mapping = mappings.find(
    (m) =>
      m.model_class_id === detection.classId &&
      detection.confidence >= (m.confidence_threshold ?? CONFIG.minConfidence)
  );

  if (!mapping) return null;

  const product = products.find(
    (p) => p.product_id === mapping.product_id && p.status === 'active'
  );

  return product ?? null;
}

export function pickPrimaryDetection(
  detections: DetectionResult[]
): DetectionResult | null {
  if (detections.length === 0) return null;
  // Pick highest confidence detection
  return detections.reduce((best, d) =>
    d.confidence > best.confidence ? d : best
  );
}
