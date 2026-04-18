import { env, pipeline, RawImage } from '@xenova/transformers';
import type { DetectionResult, DetectionService } from '../types/detection';

/** 与本地目录 `models/Xenova/yolov9-c_all` 对应（通过 Vite 映射到 `/models/`） */
const LOCAL_MODEL_ID = 'Xenova/yolov9-c_all';

type YoloPipeline = {
  (
    img: InstanceType<typeof RawImage>,
    opts: { threshold: number; percentage: boolean }
  ): Promise<
    {
      label: string;
      score: number;
      box: { xmin: number; ymin: number; xmax: number; ymax: number };
    }[]
  >;
  dispose: () => Promise<void>;
  processor?: {
    image_processor?: { size?: { shortest_edge?: number } };
  };
};

function configureTransformersEnv() {
  env.allowLocalModels = true;
  env.localModelPath = '/models/';
  env.allowRemoteModels = false;
}

export type YoloModelFile = 'model_quantized.onnx' | 'model_fp16.onnx';

export class YoloDetectionService implements DetectionService {
  private detector: YoloPipeline | null = null;
  private initPromise: Promise<void> | null = null;
  private threshold: number;
  private readonly modelFileName: YoloModelFile;

  constructor(opts?: { threshold?: number; modelFileName?: YoloModelFile }) {
    this.threshold = opts?.threshold ?? 0.25;
    this.modelFileName = opts?.modelFileName ?? 'model_quantized.onnx';
  }

  setThreshold(value: number) {
    this.threshold = value;
  }

  setProcessorShortestEdge(shortestEdge: number) {
    const size = this.detector?.processor?.image_processor?.size;
    if (size) {
      size.shortest_edge = shortestEdge;
    }
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      configureTransformersEnv();
      const common = {
        local_files_only: true,
        model_file_name: this.modelFileName,
      } as const;

      console.log('[yolo] Loading model (WASM)…');
      this.detector = (await pipeline('object-detection', LOCAL_MODEL_ID, common)) as YoloPipeline;
      console.log('[yolo] Pipeline ready');
    })();

    return this.initPromise;
  }

  async detect(frame: ImageData): Promise<DetectionResult[]> {
    const img = new RawImage(frame.data, frame.width, frame.height, 4);
    return this.detectRaw(img);
  }

  /** 避免 ImageData 拷贝，供实时页面使用 */
  async detectFromCanvas(canvas: HTMLCanvasElement): Promise<DetectionResult[]> {
    const img = RawImage.fromCanvas(canvas);
    return this.detectRaw(img);
  }

  private async detectRaw(img: InstanceType<typeof RawImage>): Promise<DetectionResult[]> {
    if (!this.detector) await this.initialize();

    const rows = await this.detector!(img, {
      threshold: this.threshold,
      percentage: false,
    });

    return rows.map((d) => ({
      classId: d.label,
      className: d.label,
      confidence: d.score,
      bbox: {
        x: d.box.xmin,
        y: d.box.ymin,
        width: d.box.xmax - d.box.xmin,
        height: d.box.ymax - d.box.ymin,
      },
    }));
  }

  dispose(): void {
    void this.detector?.dispose?.();
    this.detector = null;
    this.initPromise = null;
  }
}
