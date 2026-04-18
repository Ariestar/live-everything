import { useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useVoice } from '../hooks/useVoice';
import { generateAnswer } from '../services/qaService';

export function VoiceButton() {
  const {
    state,
    transition,
    currentProduct,
    setVoiceText,
    setCurrentAnswer,
    addQA,
  } = useAppStore();

  const { isRecording, startRecording, stopRecording, transcribe } = useVoice();

  const handleToggle = useCallback(async () => {
    if (state === 'VoiceRecording' || isRecording) {
      // Stop recording
      const blob = await stopRecording();
      if (!blob || !currentProduct) return;

      transition('VoiceProcessing');

      try {
        const text = await transcribe(blob);
        if (!text) {
          transition('InfoPanelOpen');
          return;
        }

        setVoiceText(text);
        const answer = generateAnswer(currentProduct, text);
        setCurrentAnswer(answer);
        addQA(text, answer);
        transition('AnswerDisplayed');
      } catch {
        transition('InfoPanelOpen');
      }
    } else if (
      state === 'InfoPanelOpen' ||
      state === 'AnswerDisplayed'
    ) {
      // Start recording
      await startRecording();
      transition('VoiceRecording');
    }
  }, [
    state,
    isRecording,
    currentProduct,
    startRecording,
    stopRecording,
    transcribe,
    transition,
    setVoiceText,
    setCurrentAnswer,
    addQA,
  ]);

  const isProcessing = state === 'VoiceProcessing';
  const canRecord =
    state === 'InfoPanelOpen' || state === 'AnswerDisplayed';

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={isProcessing}
        className={`
          flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
          font-medium text-sm transition-all duration-200
          ${
            isRecording
              ? 'bg-red-500/90 text-white voice-recording'
              : isProcessing
                ? 'bg-white/10 text-white/40 cursor-wait'
                : canRecord
                  ? 'bg-ar-primary/90 text-black hover:bg-ar-primary'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
          }
        `}
      >
        {isRecording ? (
          <>
            <MicOff size={16} />
            点击结束录音
          </>
        ) : isProcessing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            识别中…
          </>
        ) : (
          <>
            <Mic size={16} />
            语音提问
          </>
        )}
      </button>

      {isRecording && (
        <div className="flex items-center gap-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full animate-pulse"
              style={{
                height: `${12 + Math.random() * 12}px`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
