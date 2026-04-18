export interface FAQ {
  question: string;
  answer: string;
}

export interface Product {
  product_id: string;
  product_name: string;
  category_id: string;
  aliases: string[];
  tagline: string;
  selling_points: string[];
  specs: Record<string, string>;
  audience: string[];
  use_cases: string[];
  faq: FAQ[];
  qr_code_asset: string;
  cover_image: string;
  status: 'active' | 'inactive';
  // Future AR upgrade fields
  feature_template_path?: string;
  keypoints_config?: string;
  pose_anchor_config?: string;
  panel_anchor_offset?: string;
  box_3d_asset?: string;
}

export interface ClassMapping {
  model_class_id: string;
  model_class_name: string;
  product_id: string;
  confidence_threshold: number;
  tracking_enabled: boolean;
}
