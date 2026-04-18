import { useRef, useState, useCallback } from 'react';
import { CONFIG } from '../config';
import { TranscriptionService } from '../services/qaService';

// Stub transcription — replace with Whisper or other offline STT
class StubTranscription implements TranscriptionService {
  async initialize(): Promise<void> {
    console.log('[voice] Stub transcription initialized. Plug in Whisper here.');
  }
  async transcribe(_audio: Blob): Promise<string> {
    console.warn('[voice] Stub transcription — returning empty string.');
    return '';
  }
  dispose(): void {}
}

interface UseVoiceReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  transcribe: (audio: Blob) => Promise<string>;
  error: string | null;
  setTranscriptionService: (s: TranscriptionService) => void;
}

export function useVoice(): UseVoiceReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcriptionRef = useRef<TranscriptionService>(new StubTranscription());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      // Auto-stop after max duration
      timerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsRecording(false);
        }
      }, CONFIG.maxRecordingMs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '麦克风启动失败';
      setError(msg);
      console.error('[useVoice]', msg);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== 'recording') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Stop mic tracks
        recorder.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const transcribeAudio = useCallback(async (audio: Blob): Promise<string> => {
    try {
      return await transcriptionRef.current.transcribe(audio);
    } catch (e) {
      console.error('[useVoice] Transcription failed:', e);
      return '';
    }
  }, []);

  const setTranscriptionService = useCallback((s: TranscriptionService) => {
    transcriptionRef.current.dispose();
    transcriptionRef.current = s;
    s.initialize();
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    transcribe: transcribeAudio,
    error,
    setTranscriptionService,
  };
}
