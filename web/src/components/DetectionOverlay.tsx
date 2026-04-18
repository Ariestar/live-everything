import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useLongPress } from '../hooks/useLongPress';
import { CONFIG } from '../config';
import { BoundingBox } from '../types/detection';

interface DetectionOverlayProps {
  videoDimensions: { width: number; height: number };
  containerSize: { width: number; height: number };
}

export function DetectionOverlay({
  videoDimensions,
  containerSize,
}: DetectionOverlayProps) {
  const { currentDetection, currentProduct, state, transition } = useAppStore();

  const showQR = state === 'QRCodeVisible' || state === 'InfoPanelOpen' ||
    state === 'VoiceRecording' || state === 'VoiceProcessing' || state === 'AnswerDisplayed';

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (state === 'QRCodeVisible' && currentProduct) {
        transition('InfoPanelOpen');
      }
    },
  });

  // Convert detection bbox (model coords) to screen coords
  const screenBox = useMemo(() => {
    if (!currentDetection) return null;
    return toScreenCoords(
      currentDetection.bbox,
      videoDimensions,
      containerSize
    );
  }, [currentDetection, videoDimensions, containerSize]);

  // QR position: right side of detection box, with edge avoidance
  const qrPos = useMemo(() => {
    if (!screenBox) return null;
    return computeQRPosition(screenBox, containerSize, CONFIG.qrCodeSize);
  }, [screenBox, containerSize]);

  if (!currentDetection || !screenBox) return null;

  const showBox = state !== 'Idle' && state !== 'Lost';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Detection bounding box */}
      {showBox && (
        <div
          className="detection-box absolute transition-all duration-150 ease-out"
          style={{
            left: screenBox.x,
            top: screenBox.y,
            width: screenBox.width,
            height: screenBox.height,
          }}
        >
          {/* Class label */}
          <div className="absolute -top-7 left-0 px-2 py-0.5 bg-ar-primary/90 text-black text-xs font-bold rounded">
            {currentDetection.className}
            <span className="ml-1 opacity-70">
              {Math.round(currentDetection.confidence * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* QR Code / 种草码 */}
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
