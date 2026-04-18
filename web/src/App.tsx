import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { useCamera } from './hooks/useCamera';
import { useDetection } from './hooks/useDetection';
import { loadLabelMap, loadProducts } from './services/productService';
import { YoloDetectionService } from './services/yoloDetectionService';
import { CONFIG } from './config';
import { CameraView } from './components/CameraView';
import { DetectionOverlay } from './components/DetectionOverlay';
import { InfoPanel } from './components/InfoPanel';
import { StatusBar } from './components/StatusBar';
import { GuideText } from './components/GuideText';

export default function App() {
  const {
    setProducts,
    setLabelMap,
    transition,
    setCameraError,
  } = useAppStore();

  const { videoRef, canvasRef, start, ready, error, dimensions } = useCamera();
  const [containerSize, setContainerSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  /**
   * YOLO 是首页默认且唯一的检测服务（`Xenova/gelan-c_all`，COCO 80 类）。
   * ONNX Runtime 通过 `env.backends.onnx.wasm.proxy = true` 放 Web Worker，
   * 主线程只做 `drawImage` 与 DOM 更新 → 摄像头画面保持流畅。
   */
  const yoloService = useMemo(
    () =>
      new YoloDetectionService({
        threshold: CONFIG.yoloDetectionThreshold,
        onnxVariant: CONFIG.yoloOnnxVariant,
      }),
    []
  );

  useDetection({
    videoRef,
    canvasRef,
    enabled: ready,
    service: yoloService,
  });

  // 1) 先加载 label_mapping，再据此拉取所有定制商品 JSON
  useEffect(() => {
    (async () => {
      const labelMap = await loadLabelMap();
      setLabelMap(labelMap);
      const products = await loadProducts(labelMap);
      setProducts(products);
      console.log(
        `[App] 知识库就绪：${products.length} 个定制商品, ${
          Object.keys(labelMap).length
        } 条 label 映射`
      );
    })();
  }, [setLabelMap, setProducts]);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    setCameraError(error);
  }, [error, setCameraError]);

  useEffect(() => {
    if (ready) transition('Idle');
  }, [ready, transition]);

  useEffect(() => {
    const onResize = () => {
      setContainerSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      <CameraView videoRef={videoRef} />
      <canvas ref={canvasRef} className="hidden" />
      <DetectionOverlay
        videoDimensions={dimensions}
        containerSize={containerSize}
      />
      <InfoPanel />
      <StatusBar />
      <GuideText />
    </div>
  );
}
