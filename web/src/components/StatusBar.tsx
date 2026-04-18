import { Camera, CameraOff, Mic, MicOff, WifiOff } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { STATE_LABELS } from '../types/state';

export function StatusBar() {
  const { state, cameraReady, micReady, cameraError, products } = useAppStore();

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

      {/* Product count */}
      <div className="ar-glass rounded-lg px-2.5 py-1.5">
        <span className="text-white/50 text-xs">
          商品库: {products.length} 件
        </span>
      </div>

      {/* Camera error */}
      {cameraError && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-1.5">
          <span className="text-red-300 text-xs">{cameraError}</span>
        </div>
      )}
    </div>
  );
}
