import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useLongPress } from '../hooks/useLongPress';
import { CONFIG } from '../config';
import { BoundingBox } from '../types/detection';

const BOX_COLORS = [
  '#22d3ee', '#a78bfa', '#34d399', '#fb7185', '#fbbf24', '#60a5fa',
  '#f472b6', '#818cf8', '#2dd4bf', '#fb923c',
];

interface DetectionOverlayProps {
  videoDimensions: { width: number; height: number };
  containerSize: { width: number; height: number };
}

export function DetectionOverlay({
  videoDimensions,
  containerSize,
}: DetectionOverlayProps) {
  const { allDetections, currentDetection, currentProduct, state, transition } = useAppStore();

  const showQR = state === 'QRCodeVisible' || state === 'InfoPanelOpen' ||
    state === 'VoiceRecording' || state === 'VoiceProcessing' || state === 'AnswerDisplayed';

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (state === 'QRCodeVisible' && currentProduct) {
        transition('InfoPanelOpen');
      }
    },
  });

  // Convert all detections to screen coords
  const screenDetections = useMemo(() => {
    if (videoDimensions.width === 0) return [];
    return allDetections.map((d) => ({
      ...d,
      screenBox: toScreenCoords(d.bbox, videoDimensions, containerSize),
    }));
  }, [allDetections, videoDimensions, containerSize]);

  // Primary detection screen box (for QR positioning)
  const primaryScreenBox = useMemo(() => {
    if (!currentDetection) return null;
    return toScreenCoords(currentDetection.bbox, videoDimensions, containerSize);
  }, [currentDetection, videoDimensions, containerSize]);

  // QR position: right side of primary detection box
  const qrPos = useMemo(() => {
    if (!primaryScreenBox) return null;
    return computeQRPosition(primaryScreenBox, containerSize, CONFIG.qrCodeSize);
  }, [primaryScreenBox, containerSize]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* All detection bounding boxes */}
      {screenDetections.map((d, i) => {
        const color = BOX_COLORS[i % BOX_COLORS.length];
        const isPrimary = currentDetection && d.classId === currentDetection.classId;
        const box = d.screenBox;
        return (
          <div
            key={`${d.classId}-${i}`}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              border: `2px solid ${color}`,
              boxShadow: isPrimary ? `0 0 12px ${color}88` : 'none',
            }}
          >
            <div
              className="absolute -top-6 left-0 px-1.5 py-0.5 text-xs font-semibold rounded whitespace-nowrap"
              style={{ backgroundColor: `${color}dd`, color: '#0f172a' }}
            >
              {d.className}
              <span className="ml-1 opacity-70">
                {Math.round(d.confidence * 100)}%
              </span>
            </div>
          </div>
        );
      })}

      {/* QR Code / 种草码 (only for matched product) */}
      {showQR && qrPos && currentProduct && (
        <div
          className="absolute pointer-events-auto animate-fade-in"
          style={{ left: qrPos.x, top: qrPos.y }}
          {...longPressHandlers}
        >
          <div className="animate-qr-bounce">
            <div className="ar-glass rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer select-none">
              {currentProduct.qr_code_asset ? (
                <img
                  src={currentProduct.qr_code_asset}
                  alt="种草码"
                  className="rounded-lg"
                  style={{ width: CONFIG.qrCodeSize, height: CONFIG.qrCodeSize }}
                />
              ) : (
                <div
                  className="bg-white rounded-lg flex items-center justify-center text-gray-400 text-xs"
                  style={{ width: CONFIG.qrCodeSize, height: CONFIG.qrCodeSize }}
                >
                  QR
                </div>
              )}
              <p className="text-ar-primary text-xs font-medium whitespace-nowrap">
                长按查看详情
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toScreenCoords(
  bbox: BoundingBox,
  video: { width: number; height: number },
  container: { width: number; height: number }
) {
  const scaleX = container.width / video.width;
  const scaleY = container.height / video.height;
  const scale = Math.max(scaleX, scaleY); // object-cover
  const scaledW = video.width * scale;
  const scaledH = video.height * scale;
  const offsetX = (container.width - scaledW) / 2;
  const offsetY = (container.height - scaledH) / 2;

  return {
    x: bbox.x * scale + offsetX,
    y: bbox.y * scale + offsetY,
    width: bbox.width * scale,
    height: bbox.height * scale,
  };
}

function computeQRPosition(
  box: { x: number; y: number; width: number; height: number },
  container: { width: number; height: number },
  qrSize: number
) {
  const margin = 12;
  const totalW = qrSize + 24; // including padding
  const totalH = qrSize + 48;

  // Default: right side
  let x = box.x + box.width + margin;
  let y = box.y;

  // Edge avoidance
  if (x + totalW > container.width) {
    x = box.x - totalW - margin; // left side
  }
  if (x < 0) {
    x = box.x + (box.width - totalW) / 2; // center
  }
  if (y + totalH > container.height) {
    y = container.height - totalH - margin;
  }
  if (y < 0) y = margin;

  return { x, y };
}
