import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import {
  YoloDetectionService,
  type YoloModelFile,
} from '../services/yoloDetectionService';
import type { DetectionResult } from '../types/detection';

const COLORS = [
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#fbbf24',
  '#60a5fa',
];

export function YoloRealtimePage() {
  const { videoRef, start, ready, error, dimensions } = useCamera();
  const displayRef = useRef<HTMLCanvasElement>(null);
  const serviceRef = useRef<YoloDetectionService | null>(null);
  const busyRef = useRef(false);
  const rafRef = useRef(0);

  const [modelStatus, setModelStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [modelError, setModelError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.25);
  const [shortestEdge, setShortestEdge] = useState(224);
  const [modelFile, setModelFile] =
    useState<YoloModelFile>('model_quantized.onnx');
  const [fps, setFps] = useState(0);
  const [lastDetections, setLastDetections] = useState<DetectionResult[]>([]);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    const svc = new YoloDetectionService({
      threshold,
      modelFileName: modelFile,
    });
    serviceRef.current = svc;
    setModelStatus('loading');
    setModelError(null);
    svc
      .initialize()
      .then(() => {
        setModelStatus('ready');
        svc.setProcessorShortestEdge(shortestEdge);
      })
      .catch((e) => {
        console.error(e);
        setModelStatus('error');
        setModelError(e instanceof Error ? e.message : String(e));
      });
    return () => svc.dispose();
  }, [modelFile]);

  useEffect(() => {
    serviceRef.current?.setThreshold(threshold);
  }, [threshold]);

  useEffect(() => {
    if (modelStatus === 'ready') {
      serviceRef.current?.setProcessorShortestEdge(shortestEdge);
    }
  }, [shortestEdge, modelStatus]);

  const drawDetections = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      detections: DetectionResult[]
    ) => {
      detections.forEach((d, i) => {
        const c = COLORS[i % COLORS.length];
        const { x, y, width, height } = d.bbox;
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        const label = `${d.className} ${(d.confidence * 100).toFixed(0)}%`;
        ctx.font = '14px system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        const pad = 6;
        const lh = 20;
        ctx.fillStyle = `${c}cc`;
        ctx.fillRect(x, y - lh, tw + pad * 2, lh);
        ctx.fillStyle = '#0f172a';
        ctx.fillText(label, x + pad, y - 5);
      });
    },
    []
  );

  useEffect(() => {
    if (!ready || modelStatus !== 'ready') return;

    const video = videoRef.current;
    const display = displayRef.current;
    const svc = serviceRef.current;
    if (!video || !display || !svc) return;

    const ctx = display.getContext('2d');
    if (!ctx) return;

    let frames = 0;
    let lastTick = performance.now();

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h || busyRef.current) return;

      busyRef.current = true;
      display.width = w;
      display.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      void svc
        .detectFromCanvas(display)
        .then((dets) => {
          setLastDetections(dets);
          ctx.drawImage(video, 0, 0, w, h);
          drawDetections(ctx, dets);
        })
        .catch((e) => console.error('[yolo frame]', e))
        .finally(() => {
          busyRef.current = false;
          frames++;
          const now = performance.now();
          if (now - lastTick >= 1000) {
            setFps(Math.round((frames * 1000) / (now - lastTick)));
            frames = 0;
            lastTick = now;
          }
        });
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, modelStatus, drawDetections, videoRef]);

  const aspect =
    dimensions.width > 0 && dimensions.height > 0
      ? `${dimensions.width} / ${dimensions.height}`
      : '16 / 9';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-cyan-400/90">
              Transformers.js · 实时目标检测
            </p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              YOLOv9（本地 ONNX）+ 摄像头
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              模型来源{' '}
              <a
                className="text-cyan-400 underline decoration-cyan-400/40 underline-offset-2 hover:decoration-cyan-300"
                href="https://huggingface.co/Xenova/yolov9-c_all"
                target="_blank"
                rel="noreferrer"
              >
                Xenova/yolov9-c_all
              </a>
              ，效果参考{' '}
              <a
                className="text-cyan-400 underline decoration-cyan-400/40 underline-offset-2 hover:decoration-cyan-300"
                href="https://huggingface.co/spaces/Xenova/video-object-detection"
                target="_blank"
                rel="noreferrer"
              >
                Video Object Detection
              </a>
              。
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-white"
          >
            返回 AR 讲解
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-slate-400">
              置信度阈值（{threshold.toFixed(2)}）
            </span>
            <input
              type="range"
              min={0.05}
              max={0.9}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="accent-cyan-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-slate-400">
              输入最短边（{shortestEdge}px）
            </span>
            <input
              type="range"
              min={128}
              max={640}
              step={32}
              value={shortestEdge}
              onChange={(e) => setShortestEdge(Number(e.target.value))}
              className="accent-cyan-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-slate-400">权重</span>
            <select
              value={modelFile}
              onChange={(e) =>
                setModelFile(e.target.value as YoloModelFile)
              }
              className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400/60"
            >
              <option value="model_quantized.onnx">量化（更快）</option>
              <option value="model_fp16.onnx">FP16（更准）</option>
            </select>
          </label>
          <div className="flex flex-col justify-end gap-1 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300">
              <span>
                模型：{' '}
                <strong className="text-white">
                  {modelStatus === 'loading' && '加载中…'}
                  {modelStatus === 'ready' && '就绪'}
                  {modelStatus === 'error' && '失败'}
                </strong>
              </span>
              <span>
                推理 FPS：<strong className="text-cyan-300">{fps}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              画面 {dimensions.width}×{dimensions.height} · 当前{' '}
              {lastDetections.length} 个目标
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            摄像头：{error}
          </div>
        )}
        {modelError && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            模型：{modelError}
          </div>
        )}

        <div
          className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-cyan-950/20"
          style={{ aspectRatio: aspect }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="hidden"
          />
          <canvas
            ref={displayRef}
            className="block h-full w-full object-contain"
          />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                <p className="text-slate-300">正在请求摄像头…</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
