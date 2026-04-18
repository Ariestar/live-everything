import { create } from 'zustand';
import { AppState } from '../types/state';
import { Product, LabelMap } from '../types/product';
import { DetectionResult, TrackedObject } from '../types/detection';

interface AppStore {
  // State machine
  state: AppState;
  transition: (next: AppState) => void;

  // All raw detections from current frame
  allDetections: DetectionResult[];
  setAllDetections: (d: DetectionResult[]) => void;

  // Current tracked detection (primary / highest confidence)
  currentDetection: TrackedObject | null;
  setCurrentDetection: (d: TrackedObject | null) => void;

  // Current matched product
  currentProduct: Product | null;
  setCurrentProduct: (p: Product | null) => void;

  // Data
  products: Product[];
  setProducts: (p: Product[]) => void;
  /** COCO id → label_mapping entry（见 data/knowledge-base/config/label_mapping.json） */
  labelMap: LabelMap;
  setLabelMap: (m: LabelMap) => void;

  // Voice Q&A
  voiceText: string;
  setVoiceText: (t: string) => void;
  currentAnswer: string;
  setCurrentAnswer: (a: string) => void;
  qaHistory: Array<{ q: string; a: string }>;
  addQA: (q: string, a: string) => void;

  /** 已在后端创建的 agent_id；和 currentProduct 对齐，切换商品时自动销毁重建 */
  currentAgentId: string | null;
  setCurrentAgentId: (id: string | null) => void;
  /** 后端健康：false 时 VoiceButton 自动降级到本地 QA */
  backendReady: boolean;
  setBackendReady: (r: boolean) => void;

  // Model status
  modelStatus: 'idle' | 'loading' | 'ready' | 'error';
  setModelStatus: (s: 'idle' | 'loading' | 'ready' | 'error') => void;

  // Device status
  cameraReady: boolean;
  setCameraReady: (r: boolean) => void;
  micReady: boolean;
  setMicReady: (r: boolean) => void;
  cameraError: string | null;
  setCameraError: (e: string | null) => void;

  resetInteraction: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  state: 'Idle',
  transition: (next) =>
    set((s) => {
      if (s.state !== next) console.log(`[state] ${s.state} → ${next}`);
      return { state: next };
    }),

  allDetections: [],
  setAllDetections: (d) => set({ allDetections: d }),

  currentDetection: null,
  setCurrentDetection: (d) => set({ currentDetection: d }),

  currentProduct: null,
  setCurrentProduct: (p) => set({ currentProduct: p }),

  products: [],
  setProducts: (p) => set({ products: p }),
  labelMap: {},
  setLabelMap: (m) => set({ labelMap: m }),

  voiceText: '',
  setVoiceText: (t) => set({ voiceText: t }),
  currentAnswer: '',
  setCurrentAnswer: (a) => set({ currentAnswer: a }),
  qaHistory: [],
  addQA: (q, a) => set((s) => ({ qaHistory: [...s.qaHistory, { q, a }] })),

  currentAgentId: null,
  setCurrentAgentId: (id) => set({ currentAgentId: id }),
  backendReady: false,
  setBackendReady: (r) => set({ backendReady: r }),

  modelStatus: 'idle',
  setModelStatus: (s) => set({ modelStatus: s }),

  cameraReady: false,
  setCameraReady: (r) => set({ cameraReady: r }),
  micReady: false,
  setMicReady: (r) => set({ micReady: r }),
  cameraError: null,
  setCameraError: (e) => set({ cameraError: e }),

  resetInteraction: () =>
    set({
      state: 'Idle',
      currentDetection: null,
      currentProduct: null,
      voiceText: '',
      currentAnswer: '',
      qaHistory: [],
      currentAgentId: null,
    }),
}));
