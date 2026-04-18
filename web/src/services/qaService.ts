import { Product, FAQ } from '../types/product';

// Transcription service interface — implement to plug in Whisper or other offline STT
export interface TranscriptionService {
  initialize(): Promise<void>;
  transcribe(audio: Blob): Promise<string>;
  dispose(): void;
}

export function searchFAQ(product: Product, query: string): FAQ | null {
  const q = query.toLowerCase();
  // Direct keyword match against FAQ questions
  const match = product.faq.find((f) => {
    const fq = f.question.toLowerCase();
    // Check if query words overlap significantly with FAQ question
    const queryWords = q.split(/\s+/).filter((w) => w.length > 1);
    const matchCount = queryWords.filter((w) => fq.includes(w)).length;
    return matchCount >= Math.max(1, queryWords.length * 0.5);
  });
  return match ?? null;
}

export function generateAnswer(product: Product, query: string): string {
  // 1. Try FAQ first
  const faqMatch = searchFAQ(product, query);
  if (faqMatch) return faqMatch.answer;

  // 2. Try keyword matching against product fields
  const q = query.toLowerCase();

  if (containsAny(q, ['适合', '人群', '谁用', '适用'])) {
    if (product.audience.length > 0) {
      return `${product.product_name}适合：${product.audience.join('、')}。`;
    }
  }

  if (containsAny(q, ['场景', '用途', '用在', '怎么用'])) {
    if (product.use_cases.length > 0) {
      return `${product.product_name}的典型使用场景：${product.use_cases.join('、')}。`;
    }
  }

  if (containsAny(q, ['卖点', '优势', '特点', '亮点'])) {
    if (product.selling_points.length > 0) {
      return product.selling_points.map((p, i) => `${i + 1}. ${p}`).join('\n');
    }
  }

  if (containsAny(q, ['参数', '规格', '配置', '尺寸', '重量'])) {
    const entries = Object.entries(product.specs);
    if (entries.length > 0) {
      return entries.map(([k, v]) => `${k}：${v}`).join('\n');
    }
  }

  // 3. Fallback — conservative answer
  return '当前本地资料未覆盖该问题，请尝试换一种方式提问。';
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}
