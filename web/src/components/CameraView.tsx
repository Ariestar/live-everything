import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onReady?: () => void;
}

export function CameraView({ videoRef, onReady }: CameraViewProps) {
  const { cameraReady, setCameraReady } = useAppStore();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setCameraReady(true);
      onReady?.();
    };

    video.addEventListener('playing', handlePlay);
    return () => video.removeEventListener('playing', handlePlay);
  }, [videoRef, setCameraReady, onReady]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          cameraReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-ar-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white/60 text-lg">正在启动摄像头…</p>
          </div>
        </div>
      )}
    </div>
  );
}
