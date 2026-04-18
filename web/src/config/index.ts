const useYolo =
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.VITE_USE_YOLO === 'true';

const rawYolo = import.meta.env?.VITE_YOLO_MODEL;
/** `fp16` | `quantized`；兼容旧值 `model_fp16.onnx` */
const yoloOnnxVariant =
  rawYolo === 'fp16' || rawYolo === 'model_fp16.onnx' ? 'fp16' : 'quantized';

export const CONFIG = {
  // Detection settings
  minConfidence: 0.7,
  /** YOLO 管线过滤分数；商品匹配仍可用 minConfidence（见 class-mappings） */
  yoloDetectionThreshold: 0.25,
  stableFrameThreshold: 5,
  lostFrameThreshold: 15,
  detectionIntervalMs: 200,

  /** 为 true 时在 AR 主页使用本地 YOLOv9（需已配置 /models 与权重） */
  useYoloDetection: useYolo,
  yoloOnnxVariant: yoloOnnxVariant as 'quantized' | 'fp16',

  // UI settings
  qrCodeSize: 120,
  longPressMs: 800,
  smoothingFactor: 0.3,
  infoPanelWidth: 380,

  // Voice settings
  maxRecordingMs: 10000,

  // Data paths — replace or extend as needed
  productsPath: '/data/products.json',
  classMappingsPath: '/data/class-mappings.json',
} as const;
