/**
 * 应用级配置。YOLO 现在是首页的**默认且唯一**检测路径，
 * 不再通过环境变量开关。若想切换权重，改下面的 `yoloOnnxVariant`。
 */
export const CONFIG = {
  // ---------- 检测参数 ----------
  /** 商品匹配用的最小置信度（`matchingService` 使用） */
  minConfidence: 0.5,
  /** YOLO 输出过滤阈值（越低检测越多但更多误检） */
  yoloDetectionThreshold: 0.25,
  /** 稳定帧数阈值：连续命中同类别超过该次数才视为"稳定"并展示 QR */
  stableFrameThreshold: 5,
  /** 丢失帧数阈值：超过该次数仍未命中则进入 Lost 状态 */
  lostFrameThreshold: 15,
  /** 检测循环间隔（ms）。推理本身异步，过小没有意义反而增加排队压力 */
  detectionIntervalMs: 120,

  /**
   * 本地 ONNX 权重变体。可选 `'quantized'` (q8, ~26MB) 或 `'fp16'` (~51MB)。
   * q8 在 wasm backend 上最快且最稳定（与 HF Space 一致）。
   */
  yoloOnnxVariant: 'quantized' as 'quantized' | 'fp16',

  // ---------- UI ----------
  qrCodeSize: 120,
  longPressMs: 800,
  smoothingFactor: 0.3,
  infoPanelWidth: 380,

  // ---------- 语音 ----------
  maxRecordingMs: 10000,

  // ---------- 资源路径 ----------
  productsPath: '/data/products.json',
  classMappingsPath: '/data/class-mappings.json',
} as const;
