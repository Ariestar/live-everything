import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  YoloDetectionService,
  type YoloOnnxVariant,
} from '../services/yoloDetectionService';

/**
 * 1:1 复刻 Hugging Face Space `Xenova/video-object-detection`：
 * - `<canvas>` 显示当前帧（video 不直接显示），保证"所见即所推理"。
 * - 检测框用命令式 DOM 操作（`overlay.replaceChildren(...)`），**完全绕开 React**
 *   ——避免每次推理完成都触发整页 reconcile 导致卡顿。
 * - ONNX Runtime WASM backend 通过 `env.backends.onnx.wasm.proxy = true`
 *   放到 Web Worker 里跑，不阻塞主线程 RAF。
 * - 颜色表、标签格式、容器尺寸算法均与原站打包产物一致。
 *
 * 参考：https://huggingface.co/spaces/Xenova/video-object-detection/blob/main/assets/index-C0Q5FIv3.js
 */

/** 与原站 `COLOURS` 完全一致（20 色） */
const COLOURS = [
  '#EF4444',
  '#4299E1',
  '#059669',
  '#FBBF24',
  '#4B52B1',
  '#7B3AC2',
  '#ED507A',
  '#1DD1A1',
  '#F3873A',
  '#4B5563',
  '#DC2626',
  '#1852B4',
  '#18A35D',
  '#F59E0B',
  '#4059BE',
  '#6027A5',
  '#D63D60',
  '#00AC9B',
  '#E64A19',
  '#272A34',
];

const DEFAULT_MAX_W = 720;
const DEFAULT_MAX_H = 405;

function computeContainerSize(videoW: number, videoH: number) {
  if (!videoW || !videoH) return { width: DEFAULT_MAX_W, height: DEFAULT_MAX_H };
  const ratio = videoW / videoH;
  const maxRatio = DEFAULT_MAX_W / DEFAULT_MAX_H;
  if (ratio > maxRatio) {
    return { width: DEFAULT_MAX_W, height: DEFAULT_MAX_W / ratio };
  }
  return { width: DEFAULT_MAX_H * ratio, height: DEFAULT_MAX_H };
}

export function YoloRealtimePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);

  const serviceRef = useRef<YoloDetectionService | null>(null);
  const busyRef = useRef(false);
  const rafRef = useRef(0);
  const prevTimeRef = useRef<number | undefined>(undefined);

  // 高频可变值用 ref，避免重启 RAF
  const thresholdRef = useRef(0.25);
  const shortestEdgeRef = useRef(128);

  // 仅 UI 呈现用 state（低频）
  const [threshold, setThreshold] = useState(0.25);
  const [shortestEdge, setShortestEdge] = useState(128);
  const [onnxVariant, setOnnxVariant] = useState<YoloOnnxVariant>('quantized');
  const [containerSize, setContainerSize] = useState({
    width: DEFAULT_MAX_W,
    height: DEFAULT_MAX_H,
  });
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 命令式写入 status（避免 re-render）
  const setStatusText = (t: string) => {
    if (statusRef.current) statusRef.current.textContent = t;
  };

  // 1) 初始化模型
  useEffect(() => {
    const svc = new YoloDetectionService({
      threshold: thresholdRef.current,
      onnxVariant,
    });
    serviceRef.current = svc;
    setStatusText('Loading model…');
    svc
      .initialize()
      .then(() => {
        svc.setProcessorShortestEdge(shortestEdgeRef.current);
        setStatusText('Ready');
      })
      .catch((e) => {
        console.error(e);
        setStatusText(e instanceof Error ? e.message : String(e));
      });
    return () => {
      svc.dispose();
      serviceRef.current = null;
    };
  }, [onnxVariant]);

  // 2) 打开摄像头
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        video.srcObject = stream;
        await video.play();
        const track = stream.getVideoTracks()[0];
        const { width = 0, height = 0 } = track.getSettings();
        canvas.width = width;
        canvas.height = height;
        setContainerSize(computeContainerSize(width, height));
      } catch (e) {
        setCameraError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 3) 滑块 → ref + 服务
  useEffect(() => {
    thresholdRef.current = threshold;
    serviceRef.current?.setThreshold(threshold);
  }, [threshold]);

  useEffect(() => {
    shortestEdgeRef.current = shortestEdge;
    serviceRef.current?.setProcessorShortestEdge(shortestEdge);
  }, [shortestEdge]);

  // 4) 主循环：与原站 updateCanvas 完全一致；**不触发任何 setState**
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return;

      // 每帧都画 video → canvas（纯 GPU 路径，便宜）
      ctx.drawImage(video, 0, 0, w, h);

      const svc = serviceRef.current;
      if (!svc || busyRef.current) return;
      busyRef.current = true;

      void (async () => {
        try {
          const frame = await svc.detectRaw(canvas);
          const overlay = overlayRef.current;
          if (!overlay) return;

          const [rw, rh] = frame.reshapedSize;
          const th = frame.threshold;
          const nodes: HTMLDivElement[] = [];
          for (const [xmin, ymin, xmax, ymax, score, id] of frame.predictions) {
            if (score < th) continue;
            const color = COLOURS[id % COLOURS.length];
            const label = frame.id2label[String(id)] ?? String(id);

            const box = document.createElement('div');
            box.className = 'bounding-box';
            Object.assign(box.style, {
              position: 'absolute',
              boxSizing: 'border-box',
              border: `solid 2px ${color}`,
              left: `${(100 * xmin) / rw}%`,
              top: `${(100 * ymin) / rh}%`,
              width: `${(100 * (xmax - xmin)) / rw}%`,
              height: `${(100 * (ymax - ymin)) / rh}%`,
            } as CSSStyleDeclaration);

            const tag = document.createElement('span');
            tag.className = 'bounding-box-label';
            tag.textContent = `${label} (${(100 * score).toFixed(2)}%)`;
            Object.assign(tag.style, {
              position: 'absolute',
              color: '#fff',
              fontSize: '12px',
              margin: '-16px 0 0 -2px',
              padding: '1px',
              whiteSpace: 'nowrap',
              backgroundColor: color,
            } as CSSStyleDeclaration);

            box.appendChild(tag);
            nodes.push(box);
          }
          // 一次性替换，避免多次 reflow
          overlay.replaceChildren(...nodes);

          if (prevTimeRef.current !== undefined) {
            const fps = 1000 / (performance.now() - prevTimeRef.current);
            setStatusText(`FPS: ${fps.toFixed(2)}`);
          }
          prevTimeRef.current = performance.now();
        } catch (e) {
          console.error('[yolo tick]', e);
        } finally {
          busyRef.current = false;
        }
      })();
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-8 py-4 font-sans text-gray-900">
      <h1 className="text-center text-xl font-semibold">
        Transformers.js | Real-time object detection
      </h1>
      <h4 className="mt-2 text-center text-base font-normal text-gray-700">
        Real-time object detection w/{' '}
        <a
          className="underline"
          href="https://github.com/huggingface/transformers.js"
          target="_blank"
          rel="noreferrer"
        >
          🤗 Transformers.js
        </a>
      </h4>
      <p className="mt-1 text-center text-sm text-gray-500">
        Runs locally in your browser, powered by{' '}
        <a
          className="underline"
          href="https://huggingface.co/Xenova/gelan-c_all"
          target="_blank"
          rel="noreferrer"
        >
          YOLOv9 (gelan-c)
        </a>
      </p>

      <div id="controls" className="flex flex-wrap items-end gap-4 py-4">
        <div className="text-center">
          <label className="block text-sm text-gray-700">
            Image size <span className="font-mono">({shortestEdge})</span>
          </label>
          <input
            type="range"
            min={128}
            max={640}
            step={32}
            value={shortestEdge}
            onChange={(e) => setShortestEdge(Number(e.target.value))}
            className="mt-1 w-48 accent-gray-700"
          />
        </div>
        <div className="text-center">
          <label className="block text-sm text-gray-700">
            Threshold <span className="font-mono">({threshold.toFixed(2)})</span>
          </label>
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 w-48 accent-gray-700"
          />
        </div>
        <div className="text-center">
          <span className="block text-sm text-gray-700">Weights</span>
          <select
            value={onnxVariant}
            onChange={(e) => setOnnxVariant(e.target.value as YoloOnnxVariant)}
            className="mt-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            <option value="quantized">Quantized (faster)</option>
            <option value="fp16">FP16</option>
          </select>
        </div>
      </div>

      <p
        id="status"
        ref={statusRef}
        className="my-2 min-h-[16px] text-center text-sm text-gray-600"
      >
        Loading model…
      </p>
      {cameraError && (
        <p className="text-center text-sm text-red-600">Camera: {cameraError}</p>
      )}

      <div
        id="container"
        className="relative mt-4 max-h-full max-w-full overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-black"
        style={{
          width: `${containerSize.width}px`,
          height: `${containerSize.height}px`,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
        <canvas
          ref={canvasRef}
          className="absolute left-0 top-0 h-full w-full"
        />
        <div
          ref={overlayRef}
          id="overlay"
          className="pointer-events-none absolute left-0 top-0 h-full w-full"
        />
      </div>

      <Link
        to="/"
        className="mt-6 text-sm text-gray-500 underline decoration-gray-400 hover:text-gray-800"
      >
        ← AR 商品讲解
      </Link>
    </div>
  );
}
