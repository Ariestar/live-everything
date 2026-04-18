export const CONFIG = {
  // Detection settings
  minConfidence: 0.7,
  stableFrameThreshold: 5,
  lostFrameThreshold: 15,
  detectionIntervalMs: 200,

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
