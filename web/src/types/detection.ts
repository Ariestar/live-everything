export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  classId: string;
  className: string;
  confidence: number;
  bbox: BoundingBox;
  trackingId?: string;
}

// Future AR upgrade fields
export interface PoseEstimate {
  rotation: [number, number, number];
  translation: [number, number, number];
  confidenceHistory: number[];
}

export interface TrackedObject extends DetectionResult {
  pose?: PoseEstimate;
  framesSinceLastSeen: number;
  stableFrameCount: number;
}

// Detection service interface — implement this to plug in YOLO or other models
export interface DetectionService {
  initialize(): Promise<void>;
  detect(frame: ImageData): Promise<DetectionResult[]>;
  dispose(): void;
}
