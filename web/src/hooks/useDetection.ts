import { useRef, useCallback, useEffect } from 'react';
import { TrackedObject, DetectionService } from '../types/detection';
import { CONFIG } from '../config';
import { useAppStore } from '../store/useAppStore';
import {
  matchDetectionToProduct,
  pickPrimaryDetection,
} from '../services/matchingService';

interface UseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  enabled: boolean;
  service: DetectionService;
}

export function useDetection({
  videoRef,
  canvasRef,
  enabled,
  service,
}: UseDetectionOptions) {
  const detectionService = useRef<DetectionService>(service);

  useEffect(() => {
    if (service !== detectionService.current) {
      detectionService.current?.dispose?.();
      detectionService.current = service;
    }
  }, [service]);

  const trackedRef = useRef<TrackedObject | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef = useRef(0);
  /** 防止前一帧推理未结束就启动新一帧，造成主线程排队卡顿 */
  const busyRef = useRef(false);

  const {
    transition,
    setAllDetections,
    setCurrentDetection,
    setCurrentProduct,
    setModelStatus,
    products,
    labelMap,
    state,
    resetInteraction,
  } = useAppStore();

  const processFrame = useCallback(async () => {
    if (busyRef.current) return;
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    busyRef.current = true;
    try {
      const detections = await detectionService.current.detect(frame);
      setAllDetections(detections);
      const primary = pickPrimaryDetection(detections, labelMap, products);

      if (primary) {
        const prev = trackedRef.current;
        const isSame = prev && prev.classId === primary.classId;

        const tracked: TrackedObject = {
          ...primary,
          framesSinceLastSeen: 0,
          stableFrameCount: isSame ? prev!.stableFrameCount + 1 : 1,
          bbox:
            prev && isSame
              ? smoothBBox(prev.bbox, primary.bbox, CONFIG.smoothingFactor)
              : primary.bbox,
        };

        trackedRef.current = tracked;
        setCurrentDetection(tracked);

        if (tracked.stableFrameCount >= CONFIG.stableFrameThreshold) {
          const product = matchDetectionToProduct(primary, labelMap, products);
          if (product) {
            setCurrentProduct(product);
            if (state === 'Idle' || state === 'Detecting') {
              transition('Matched');
              setTimeout(() => transition('QRCodeVisible'), 250);
            }
          } else {
            setCurrentProduct(null);
            if (state === 'Idle') transition('Detecting');
          }
        } else if (state === 'Idle') {
          transition('Detecting');
        }

        frameCountRef.current = 0;
      } else {
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
            }, 700);
          }
        }
      }
    } catch (e) {
      console.error(
        '[detection] Frame processing error:',
        e instanceof Error ? e.message : e,
        e
      );
    } finally {
      busyRef.current = false;
    }
  }, [
    videoRef,
    canvasRef,
    labelMap,
    products,
    state,
    transition,
    setAllDetections,
    setCurrentDetection,
    setCurrentProduct,
    resetInteraction,
  ]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    if (!detectionService.current) {
      console.error('[detection] 缺少 DetectionService 实例，跳过初始化');
      setModelStatus('error');
      return;
    }

    setModelStatus('loading');
    detectionService.current
      .initialize()
      .then(() => {
        if (cancelled) return;
        setModelStatus('ready');
        console.log('[detection] 模型就绪，启动检测循环');
        intervalRef.current = setInterval(
          processFrame,
          CONFIG.detectionIntervalMs
        );
      })
      .catch((e) => {
        setModelStatus('error');
        console.error('[detection] 模型初始化失败:', e);
      });

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, processFrame, setModelStatus]);

  return {
    setService: (s: DetectionService) => {
      detectionService.current?.dispose?.();
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
