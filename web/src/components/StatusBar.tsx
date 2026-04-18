import { Camera, CameraOff, Mic, MicOff, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { STATE_LABELS } from '../types/state';

export function StatusBar() {
  const { state, modelStatus, cameraReady, micReady, cameraError, products, allDetections } = useAppStore();

  return (
    <div className="absolute top-4 left-4 z-30 flex items-center gap-3">
      {/* State badge */}
      <div className="ar-glass rounded-lg px-3 py-1.5 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            state === 'Idle'
              ? 'bg-white/40'
              : state === 'Lost'
                ? 'bg-red-400 animate-pulse'
                : 'bg-ar-primary animate-pulse-slow'
          }`}
        />
        <span className="text-white/70 text-xs font-medium">
          {STATE_LABELS[state]}
        </span>
      </div>

      {/* Device indicators */}
      <div className="ar-glass rounded-lg px-2.5 py-1.5 flex items-center gap-2">
        {cameraReady ? (
          <Camera size={14} className="text-green-400" />
        ) : (
          <CameraOff size={14} className="text-red-400" />
        )}
        {micReady ? (
          <Mic size={14} className="text-green-400" />
        ) : (
          <MicOff size={14} className="text-white/30" />
        )}
        <WifiOff size={14} className="text-white/20" />
      </div>

      {/* Model status */}
      <div className="ar-glass rounded-lg px-2.5 py-1.5">
        <span className={`text-xs font-medium ${
          modelStatus === 'loading' ? 'text-yellow-300 animate-pulse' :
          modelStatus === 'ready' ? 'text-green-400' :
          modelStatus === 'error' ? 'text-red-400' : 'text-white/40'
        }`}>
          YOLO {modelStatus === 'loading' ? '加载中…' :
                modelStatus === 'ready' ? `就绪 · ${allDetections.length} 目标` :
                modelStatus === 'error' ? '加载失败' : '待机'}
        </span>
      </div>

      {/* Product count */}
      <div className="ar-glass rounded-lg px-2.5 py-1.5">
        <span className="text-white/50 text-xs">
          商品库: {products.length} 件
        </span>
      </div>

      <Link
        to="/detect"
        className="ar-glass rounded-lg px-2.5 py-1.5 text-xs font-medium text-cyan-300/90 hover:text-cyan-200"
      >
        YOLO 检测
      </Link>

      {/* Camera error */}
      {cameraError && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1.5">
          <span className="text-red-300 text-xs">{cameraError}</span>
        </div>
      )}
    </div>
  );
}
