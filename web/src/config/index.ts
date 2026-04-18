/**
 * 应用级配置。YOLO 是首页的**默认且唯一**检测路径，
 * 知识库位于 `data/knowledge-base`（由 `vite.config.ts` 挂到 `/kb/`）。
 */
export const CONFIG = {
  // ---------- 检测参数 ----------
  /** 商品匹配用的最小置信度（`matchingService` 使用） */
  minConfidence: 0.45,
  /** YOLO 原始输出过滤阈值（越低检测越多但更多误检） */
  yoloDetectionThreshold: 0.25,
  /** 连续 N 帧命中同类才进入"稳定匹配"状态 */
  stableFrameThreshold: 3,
  /** 连续 N 帧未命中则进入 Lost */
  lostFrameThreshold: 12,
  /** 检测循环间隔（ms）。推理本身异步，过小没意义 */
  detectionIntervalMs: 110,

  /**
   * 本地 ONNX 权重变体。`'quantized'` (q8, ~26MB) 在 wasm backend 上最快。
   */
  yoloOnnxVariant: 'quantized' as 'quantized' | 'fp16',

  // ---------- UI ----------
  qrCodeSize: 108,
  longPressMs: 700,
  /** bbox 平滑系数（0~1），越大响应越快但越抖 */
  smoothingFactor: 0.35,
  infoPanelWidth: 380,

  // ---------- 语音 ----------
  maxRecordingMs: 10000,

  // ---------- 资源路径 ----------
  /** Vite 中间件把 `data/knowledge-base` 挂到这里，最后一位需为 `/` */
  knowledgeBasePath: '/kb/',
} as const;
