import { Product, FAQ } from '../types/product';

// 预留：后续插入 Whisper 或其他离线 STT 实现
export interface TranscriptionService {
  initialize(): Promise<void>;
  transcribe(audio: Blob): Promise<string>;
  dispose(): void;
}

/**
 * 从 FAQ 中找最相关条目：简单但有效的三段式打分
 *   1) 问题全词包含 → 高分
 *   2) 中文 1-gram 字符重合率
 *   3) 命中阈值 `0.34` 视为匹配
 */
export function searchFAQ(product: Product, query: string): FAQ | null {
  const q = normalize(query);
  if (!q) return null;

  let best: { faq: FAQ; score: number } | null = null;
  for (const faq of product.faq) {
    const qText = normalize(faq.question);
    const aText = normalize(faq.answer);
    const score = Math.max(
      overlapScore(q, qText),
      overlapScore(q, aText) * 0.6
    );
    if (!best || score > best.score) best = { faq, score };
  }
  return best && best.score >= 0.34 ? best.faq : null;
}

export function generateAnswer(product: Product, query: string): string {
  // 1) FAQ 命中优先
  const faqMatch = searchFAQ(product, query);
  if (faqMatch) return faqMatch.answer;

  const q = normalize(query);

  // 2) 意图分类 → question_type_answers
  const qta = product.question_type_answers ?? {};
  if (containsAny(q, ['你是', '介绍一下', '是什么', '你好'])) {
    if (qta.intro) return qta.intro;
    if (product.self_intro_short) return product.self_intro_short;
  }
  if (containsAny(q, ['卖点', '优势', '特点', '亮点', '为什么'])) {
    if (qta.selling_point) return qta.selling_point;
    if (product.selling_points.length > 0) {
      return product.selling_points
        .map((p, i) => `${i + 1}. ${p.title} —— ${p.detail}`)
        .join('\n');
    }
  }
  if (containsAny(q, ['场景', '用途', '用在', '怎么用', '适合什么场景'])) {
    if (qta.use_case) return qta.use_case;
    if (product.use_cases.length > 0) {
      return `${product.product_name}的典型使用场景：${product.use_cases.join('、')}。`;
    }
  }
  if (containsAny(q, ['参数', '规格', '配置', '尺寸', '重量', '容量', '续航'])) {
    if (qta.spec) return qta.spec;
    if (product.specs.length > 0) {
      return product.specs.map((s) => `${s.name}：${s.value}`).join('\n');
    }
  }
  if (containsAny(q, ['适合', '人群', '谁用', '适用'])) {
    if (product.audience.length > 0) {
      return `${product.product_name}适合：${product.audience.join('、')}。`;
    }
  }
  if (containsAny(q, ['对比', '区别', '相比', '与'])) {
    if (qta.comparison) return qta.comparison;
  }
  if (containsAny(q, ['缺点', '局限', '边界', '不能', '不适合'])) {
    if (qta.limitation) return qta.limitation;
    if (product.limitations && product.limitations.length > 0) {
      return product.limitations.map((l, i) => `${i + 1}. ${l}`).join('\n');
    }
  }

  // 3) 兜底：保守回答
  return (
    qta.unknown ??
    '当前本地资料未覆盖这一问题。你可以换一个方式问我，或看看介绍窗里的"你也可以继续问"里的示例。'
  );
}

/* ------------------- 工具函数 ------------------- */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/** 基于字符的 Jaccard 重合度；字符越多的词权重越高 */
function overlapScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  setA.forEach((c) => {
    if (setB.has(c)) inter++;
  });
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}
