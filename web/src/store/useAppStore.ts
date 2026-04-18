import { create } from 'zustand';
import { AppState } from '../types/state';
import { Product, ClassMapping } from '../types/product';
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
  classMappings: ClassMapping[];
  setClassMappings: (m: ClassMapping[]) => void;

  // Voice Q&A
  voiceText: string;
  setVoiceText: (t: string) => void;
  currentAnswer: string;
  setCurrentAnswer: (a: string) => void;
  qaHistory: Array<{ q: string; a: string }>;
  addQA: (q: string, a: string) => void;

  // Device status
  cameraReady: boolean;
  setCameraReady: (r: boolean) => void;
  micReady: boolean;
  setMicReady: (r: boolean) => void;
  cameraError: string | null;
  setCameraError: (e: string | null) => void;

  // Reset interaction state
  resetInteraction: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  state: 'Idle',
  transition: (next) =>
    set((s) => {
      console.log(`[state] ${s.state} → ${next}`);
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
  classMappings: [],
  setClassMappings: (m) => set({ classMappings: m }),

  voiceText: '',
  setVoiceText: (t) => set({ voiceText: t }),
  currentAnswer: '',
  setCurrentAnswer: (a) => set({ currentAnswer: a }),
  qaHistory: [],
  addQA: (q, a) =>
    set((s) => ({ qaHistory: [...s.qaHistory, { q, a }] })),

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
    }),
}));
