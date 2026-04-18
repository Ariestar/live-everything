import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { useCamera } from './hooks/useCamera';
import { useDetection } from './hooks/useDetection';
import { loadProducts, loadClassMappings } from './services/productService';
import { YoloDetectionService } from './services/yoloDetectionService';
import { CameraView } from './components/CameraView';
import { DetectionOverlay } from './components/DetectionOverlay';
import { InfoPanel } from './components/InfoPanel';
import { StatusBar } from './components/StatusBar';
import { GuideText } from './components/GuideText';

export default function App() {
  const { setProducts, setClassMappings, transition, setCameraError } =
    useAppStore();

  const { videoRef, canvasRef, start, ready, error, dimensions } = useCamera();
  const [containerSize, setContainerSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const yoloService = useMemo(
    () => new YoloDetectionService(),
    []
  );

  // Initialize detection loop
  useDetection({
    videoRef,
    canvasRef,
    enabled: ready,
    service: yoloService,
  });

  // Load product data on mount
  useEffect(() => {
    async function init() {
      const [products, mappings] = await Promise.all([
        loadProducts(),
        loadClassMappings(),
      ]);
      setProducts(products);
      setClassMappings(mappings);
      console.log(
        `[App] Loaded ${products.length} products, ${mappings.length} mappings`
      );
    }
    init();
  }, [setProducts, setClassMappings]);

  // Start camera on mount
  useEffect(() => {
    start();
  }, [start]);

  // Track camera errors
  useEffect(() => {
    setCameraError(error);
  }, [error, setCameraError]);

  // Track camera ready → transition to Detecting
  useEffect(() => {
    if (ready) {
      transition('Idle');
    }
  }, [ready, transition]);

  // Resize handler
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
      {/* Camera feed */}
      <CameraView videoRef={videoRef} />

      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Detection overlay: bounding box + QR code */}
      <DetectionOverlay
        videoDimensions={dimensions}
        containerSize={containerSize}
      />

      {/* Info panel (slides in from right) */}
      <InfoPanel />

      {/* Status bar (top-left) */}
      <StatusBar />

      {/* Guide text (bottom center) */}
      <GuideText />
    </div>
  );
}
