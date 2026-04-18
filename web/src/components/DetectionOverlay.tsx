import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useLongPress } from '../hooks/useLongPress';
import { CONFIG } from '../config';
import { BoundingBox, DetectionResult } from '../types/detection';
import { labelMapEntryFor } from '../services/matchingService';

interface DetectionOverlayProps {
  videoDimensions: { width: number; height: number };
  containerSize: { width: number; height: number };
}

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function DetectionOverlay({
  videoDimensions,
  containerSize,
}: DetectionOverlayProps) {
  const {
    allDetections,
    currentDetection,
    currentProduct,
    labelMap,
    state,
    transition,
  } = useAppStore();

  const showQR =
    state === 'QRCodeVisible' ||
    state === 'InfoPanelOpen' ||
    state === 'VoiceRecording' ||
    state === 'VoiceProcessing' ||
    state === 'AnswerDisplayed';

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (currentProduct && state === 'QRCodeVisible') {
        transition('InfoPanelOpen');
      }
    },
  });

  const primaryScreenBox = useMemo(() => {
    if (!currentDetection || videoDimensions.width === 0) return null;
    return toScreenCoords(currentDetection.bbox, videoDimensions, containerSize);
  }, [currentDetection, videoDimensions, containerSize]);

  const secondaryBoxes = useMemo(() => {
    if (videoDimensions.width === 0) return [];
    return allDetections
      .filter(
        (d) => !currentDetection || d.classIdNum !== currentDetection.classIdNum
      )
      .map((d) => ({
        det: d,
        box: toScreenCoords(d.bbox, videoDimensions, containerSize),
      }));
  }, [allDetections, currentDetection, videoDimensions, containerSize]);

  const qrPos = useMemo(() => {
    if (!primaryScreenBox) return null;
    return computeQRPosition(primaryScreenBox, containerSize, CONFIG.qrCodeSize);
  }, [primaryScreenBox, containerSize]);

  const primaryLabel = currentDetection
    ? labelMapEntryFor(currentDetection, labelMap)
    : undefined;
  const primaryIsMatched = !!currentProduct;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* ---------- 非主目标（细线 + 中文标签） ---------- */}
      {secondaryBoxes.map(({ det, box }, i) => {
        const entry = labelMapEntryFor(det, labelMap);
        return (
          <SecondaryBox
            key={`${det.classIdNum}-${i}`}
            box={box}
            label={entry?.zh ?? det.className}
            confidence={det.confidence}
          />
        );
      })}

      {/* ---------- 主目标（HUD 绚丽框） ---------- */}
      {primaryScreenBox && currentDetection && (
        <PrimaryBox
          box={primaryScreenBox}
          detection={currentDetection}
          zhLabel={primaryLabel?.zh ?? currentDetection.className}
          isMatched={primaryIsMatched}
          productName={currentProduct?.product_name}
          tagline={currentProduct?.one_line_hook ?? currentProduct?.tagline}
        />
      )}

      {/* ---------- QR 跟随卡片 ---------- */}
      {showQR && qrPos && currentProduct && (
        <div
          className="absolute"
          style={{
            left: qrPos.x,
            top: qrPos.y,
            transition: 'left 160ms linear, top 160ms linear',
          }}
          {...longPressHandlers}
        >
          <div className="ar-qr-card">
            {currentProduct.qr_code_asset ? (
              <img
                src={`${CONFIG.knowledgeBasePath}${currentProduct.qr_code_asset}`}
                alt="种草码"
                className="rounded-lg bg-white"
                style={{
                  width: CONFIG.qrCodeSize,
                  height: CONFIG.qrCodeSize,
                  objectFit: 'cover',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <QrPlaceholder size={CONFIG.qrCodeSize} />
            )}
            <span className="ar-qr-hint">长按查看详情 →</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------- 子组件 ----------------------- */

function PrimaryBox({
  box,
  detection,
  zhLabel,
  isMatched,
  productName,
  tagline,
}: {
  box: ScreenRect;
  detection: DetectionResult;
  zhLabel: string;
  isMatched: boolean;
  productName?: string;
  tagline?: string;
}) {
  const boxStyle: React.CSSProperties = {
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
  };

  if (!isMatched) {
    // 识别到但未命中定制商品：用中等强度边框 + 中文标签
    return (
      <div
        className="absolute rounded-md border border-cyan-300/70 shadow-[0_0_14px_rgba(0,212,255,0.3)]"
        style={{
          ...boxStyle,
          transition: 'all 140ms linear',
        }}
      >
        <div className="absolute -top-7 left-0">
          <span className="ar-label-chip">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 mr-1" />
            {zhLabel}
            <span className="opacity-60 ml-1">
              {Math.round(detection.confidence * 100)}%
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute" style={boxStyle}>
      {/* 渐变描边（独立层） */}
      <div className="ar-hud-box" style={{ inset: 0, position: 'absolute' }} />
      {/* 科技感底纹 */}
      <div className="ar-hud-inner" />
      {/* 扫描线 */}
      <div className="ar-scanline" />
      {/* 四角 L 型 */}
      <div className="ar-corner ar-corner--tl" />
      <div className="ar-corner ar-corner--tr" />
      <div className="ar-corner ar-corner--bl" />
      <div className="ar-corner ar-corner--br" />

      {/* HUD 顶部胶囊 */}
      <div className="ar-hud-badge">
        <span className="ar-hud-badge__dot" />
        <span className="font-semibold">{productName ?? zhLabel}</span>
        <span className="ar-hud-badge__meta mono">
          · {zhLabel} · {Math.round(detection.confidence * 100)}%
        </span>
      </div>

      {/* 底部 tagline（短句） */}
      {tagline && (
        <div
          className="absolute left-0 right-0 -bottom-8 px-3 py-1.5 rounded-lg text-[11px] leading-snug text-cyan-100/90 backdrop-blur-md"
          style={{
            background:
              'linear-gradient(90deg, rgba(9,14,28,0.75), rgba(23,18,58,0.75))',
            border: '1px solid rgba(0, 255, 225, 0.28)',
          }}
        >
          <span className="opacity-80 line-clamp-1">{tagline}</span>
        </div>
      )}
    </div>
  );
}

function SecondaryBox({
  box,
  label,
  confidence,
}: {
  box: ScreenRect;
  label: string;
  confidence: number;
}) {
  return (
    <div
      className="ar-detection-box"
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
      }}
    >
      <div className="absolute -top-6 left-0">
        <span className="ar-label-chip">
          {label}
          <span className="opacity-55 ml-1 mono">
            {Math.round(confidence * 100)}
          </span>
        </span>
      </div>
    </div>
  );
}

function QrPlaceholder({ size }: { size: number }) {
  return (
    <div
      className="bg-gradient-to-br from-white to-slate-200 rounded-lg flex items-center justify-center text-slate-600 text-xs font-medium"
      style={{ width: size, height: size }}
    >
      种草码
    </div>
  );
}

/* ----------------------- 工具函数 ----------------------- */

function toScreenCoords(
  bbox: BoundingBox,
  video: { width: number; height: number },
  container: { width: number; height: number }
): ScreenRect {
  if (video.width === 0 || video.height === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scaleX = container.width / video.width;
  const scaleY = container.height / video.height;
  // `object-cover` 语义 → 用较大的比例，另一轴偏移裁切
  const scale = Math.max(scaleX, scaleY);
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
  box: ScreenRect,
  container: { width: number; height: number },
  qrSize: number
) {
  const margin = 16;
  const totalW = qrSize + 32;
  const totalH = qrSize + 48;

  let x = box.x + box.width + margin;
  let y = box.y;

  if (x + totalW > container.width) {
    x = box.x - totalW - margin;
  }
  if (x < 0) {
    x = Math.max(margin, box.x + (box.width - totalW) / 2);
  }
  if (y + totalH > container.height) {
    y = container.height - totalH - margin;
  }
  if (y < margin) y = margin;

  return { x, y };
}
