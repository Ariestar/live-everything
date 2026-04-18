import { useRef, useCallback, useEffect } from 'react';
import { DetectionResult, TrackedObject, DetectionService } from '../types/detection';
import { CONFIG } from '../config';
import { useAppStore } from '../store/useAppStore';
import { matchDetectionToProduct, pickPrimaryDetection } from '../services/matchingService';

// Stub detection service — replace with real YOLO implementation
class StubDetectionService implements DetectionService {
  async initialize(): Promise<void> {
    console.log('[detection] Stub service initialized. Plug in YOLO here.');
  }
  async detect(_frame: ImageData): Promise<DetectionResult[]> {
    return [];
  }
  dispose(): void {
    console.log('[detection] Stub service disposed.');
  }
}

interface UseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  enabled: boolean;
  service?: DetectionService;
}

export function useDetection({
  videoRef,
  canvasRef,
  enabled,
  service,
}: UseDetectionOptions) {
  const detectionService = useRef<DetectionService>(
    service ?? new StubDetectionService()
  );

  // Keep ref in sync when the prop changes (e.g. YOLO service replaces stub)
  useEffect(() => {
    if (service && service !== detectionService.current) {
      detectionService.current.dispose();
      detectionService.current = service;
    }
  }, [service]);

  const trackedRef = useRef<TrackedObject | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef = useRef(0);

  const {
    transition,
    setCurrentDetection,
    setCurrentProduct,
    products,
    classMappings,
    state,
    resetInteraction,
  } = useAppStore();

  const processFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      const detections = await detectionService.current.detect(frame);
      const primary = pickPrimaryDetection(detections);

      if (primary) {
        const prev = trackedRef.current;
        const isSame = prev && prev.classId === primary.classId;

        const tracked: TrackedObject = {
          ...primary,
          framesSinceLastSeen: 0,
          stableFrameCount: isSame ? (prev!.stableFrameCount + 1) : 1,
          // Smooth bbox position
          bbox: prev && isSame
            ? smoothBBox(prev.bbox, primary.bbox, CONFIG.smoothingFactor)
            : primary.bbox,
        };

        trackedRef.current = tracked;
        setCurrentDetection(tracked);

        if (tracked.stableFrameCount >= CONFIG.stableFrameThreshold) {
          const product = matchDetectionToProduct(primary, classMappings, products);
          if (product) {
            setCurrentProduct(product);
            if (state === 'Idle' || state === 'Detecting') {
              transition('Matched');
              // Auto-show QR code after match
              setTimeout(() => transition('QRCodeVisible'), 300);
            }
          }
        } else if (state === 'Idle') {
          transition('Detecting');
        }

        frameCountRef.current = 0;
      } else {
        // No detection
        frameCountRef.current++;
        if (trackedRef.current) {
          trackedRef.current = {
            ...trackedRef.current,
            framesSinceLastSeen: trackedRef.current.framesSinceLastSeen + 1,
          };
          setCurrentDetection(trackedRef.current);
        }

        if (frameCountRef.current >= CONFIG.lostFrameThreshold) {
          if (state !== 'Idle') {
            transition('Lost');
            setTimeout(() => {
              trackedRef.current = null;
              resetInteraction();
            }, 1000);
          }
        }
      }
    } catch (e) {
      console.error('[detection] Frame processing error:', e);
    }
  }, [
    videoRef,
    canvasRef,
    classMappings,
    products,
    state,
    transition,
    setCurrentDetection,
    setCurrentProduct,
    resetInteraction,
  ]);

  useEffect(() => {
    if (enabled) {
      detectionService.current.initialize();
      intervalRef.current = setInterval(processFrame, CONFIG.detectionIntervalMs);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, processFrame]);

  return {
    setService: (s: DetectionService) => {
      detectionService.current.dispose();
      detectionService.current = s;
      s.initialize();
    },
  };
}

function smoothBBox(
  prev: { x: number; y: number; width: number; height: number },
  next: { x: number; y: number; width: number; height: number },
  factor: number
) {
  return {
    x: prev.x + (next.x - prev.x) * factor,
    y: prev.y + (next.y - prev.y) * factor,
    width: prev.width + (next.width - prev.width) * factor,
    height: prev.height + (next.height - prev.height) * factor,
  };
}
