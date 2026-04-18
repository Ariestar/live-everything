/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_YOLO?: string;
  readonly VITE_YOLO_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
