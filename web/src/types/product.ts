export interface SellingPoint {
  title: string;
  detail: string;
  scene_value?: string;
}

export interface Spec {
  name: string;
  value: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface GuidedDemoLine {
  step: string;
  line: string;
}

export interface VisualIdentity {
  shape_language?: string;
  material_impression?: string;
  notable_cues?: string[];
}

/**
 * 与 `data/knowledge-base/products/custom/*.json` 的字段对齐。
 * 字段全部 optional 或预设 default，以容忍不同商品 JSON 的字段差异。
 */
export interface Product {
  product_id: string;
  product_name: string;
  category_id?: string;
  semantic_category_id?: string;
  aliases: string[];
  tagline: string;
  one_line_hook?: string;
  self_intro_short?: string;
  self_intro_medium?: string;
  story_monologue_90s?: string;
  visual_identity?: VisualIdentity;
  core_values: string[];
  selling_points: SellingPoint[];
  specs: Spec[];
  audience: string[];
  use_cases: string[];
  guided_demo_script: GuidedDemoLine[];
  limitations?: string[];
  care_tips?: string[];
  common_misunderstandings?: string[];
  /** `intro` / `selling_point` / `use_case` / `spec` / `comparison` / `limitation` / `unknown` */
  question_type_answers?: Record<string, string>;
  follow_up_questions?: string[];
  faq: FAQ[];
  qr_code_asset?: string;
  cover_image?: string;
  status: 'active' | 'inactive';
}

/** 一条 COCO label 的知识库映射（`data/knowledge-base/config/label_mapping.json`） */
export interface LabelEntry {
  en: string;
  zh: string;
  baike_query?: string;
  semantic_category_id?: string;
  /** 命中定制商品时不为 null；为空代表当前无定制内容（走通用态） */
  custom_product_id: string | null;
}

/** key 是 COCO 数字 id 的字符串化（与 `model.config.id2label` 对齐） */
export type LabelMap = Record<string, LabelEntry>;
