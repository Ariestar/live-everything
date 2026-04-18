import { useCallback } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { VoiceButton } from './VoiceButton';

export function InfoPanel() {
  const { state, currentProduct, transition, qaHistory, currentAnswer } =
    useAppStore();

  const isOpen =
    state === 'InfoPanelOpen' ||
    state === 'VoiceRecording' ||
    state === 'VoiceProcessing' ||
    state === 'AnswerDisplayed';

  const handleClose = useCallback(() => {
    transition('QRCodeVisible');
  }, [transition]);

  if (!isOpen || !currentProduct) return null;

  return (
    <div className="absolute right-4 top-4 bottom-4 w-[380px] animate-slide-in pointer-events-auto z-20">
      <div className="ar-glass rounded-2xl h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-2 border-b border-ar-glass-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-lg font-bold truncate">
              {currentProduct.product_name}
            </h2>
            <p className="text-ar-primary text-sm mt-1 line-clamp-2">
              {currentProduct.tagline}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto info-scroll p-4 space-y-4">
          {/* Cover image */}
          {currentProduct.cover_image && (
            <img
              src={currentProduct.cover_image}
              alt={currentProduct.product_name}
              className="w-full h-40 object-cover rounded-xl"
            />
          )}

          {/* Selling points */}
          {currentProduct.selling_points.length > 0 && (
            <Section title="核心卖点">
              <ul className="space-y-2">
                {currentProduct.selling_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/80 text-sm">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-ar-primary/20 text-ar-primary text-xs flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Specs */}
          {Object.keys(currentProduct.specs).length > 0 && (
            <Section title="基础参数">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(currentProduct.specs).map(([key, val]) => (
                  <div key={key} className="text-sm">
                    <span className="text-white/40">{key}</span>
                    <span className="text-white/80 ml-1">{val}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Audience */}
          {currentProduct.audience.length > 0 && (
            <Section title="适用人群">
              <div className="flex flex-wrap gap-2">
                {currentProduct.audience.map((a, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full bg-ar-accent/20 text-ar-accent text-xs"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Use cases */}
          {currentProduct.use_cases.length > 0 && (
            <Section title="应用场景">
              <div className="flex flex-wrap gap-2">
                {currentProduct.use_cases.map((u, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full bg-white/10 text-white/70 text-xs"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Q&A History */}
          {qaHistory.length > 0 && (
            <Section title="问答记录">
              <div className="space-y-3">
                {qaHistory.map((qa, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-ar-primary text-xs">Q: {qa.q}</p>
                    <p className="text-white/80 text-sm">{qa.a}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Current answer */}
          {state === 'VoiceProcessing' && (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <div className="w-4 h-4 border-2 border-ar-primary border-t-transparent rounded-full animate-spin" />
              正在处理语音…
            </div>
          )}

          {state === 'AnswerDisplayed' && currentAnswer && (
            <div className="p-3 rounded-xl bg-ar-primary/10 border border-ar-primary/20">
              <p className="text-white/90 text-sm whitespace-pre-line">
                {currentAnswer}
              </p>
            </div>
          )}
        </div>

        {/* Voice button area */}
        <div className="p-4 pt-2 border-t border-ar-glass-border">
          <VoiceButton />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
