import { useRef, useState, useCallback } from 'react';
import { CONFIG } from '../config';
import { useAppStore } from '../store/useAppStore';

/**
 * 浏览器录音 hook。关键约束：
 *   1. 显式挑选 `mimeType`：优先 `audio/webm;codecs=opus`，避免部分浏览器默认
 *      生成 `video/webm` 造成后端解不出音频。
 *   2. 统一 `onstop` 终结：不管是用户点了「结束录音」还是 10 秒上限触发的自动停止，
 *      录音结果都会通过同一条 finalize 路径产出一个 Blob。
 *   3. `micReady` 仅在真正录音中为 true，录完或失败都会回到 false。
 */

interface UseVoiceReturn {
  isRecording: boolean;
  /** 返回 true 表示 MediaRecorder 真的在跑；false 表示失败（权限/硬件/浏览器不支持） */
  startRecording: (onAutoFinish?: (blob: Blob) => void | Promise<void>) => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
}

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
  ];
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* noop */
    }
  }
  return undefined;
}

export function useVoice(): UseVoiceReturn {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeRef = useRef<string>('audio/webm');
  /** stopRecording 等待的 resolve；优先级高于 autoFinish。 */
  const pendingResolveRef = useRef<((b: Blob | null) => void) | null>(null);
  /** 10 秒上限触发的自动结束回调；仅在没人等 stopRecording 时走这里。 */
  const autoFinishRef = useRef<((blob: Blob) => void | Promise<void>) | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setMicReady = useAppStore((s) => s.setMicReady);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(
    async (onAutoFinish?: (blob: Blob) => void | Promise<void>): Promise<boolean> => {
      setError(null);

      const nav: any = navigator;
      if (!nav?.mediaDevices?.getUserMedia) {
        const msg =
          '浏览器不支持麦克风 API。请使用最新版 Chrome/Edge，并在 HTTPS 或 localhost 下打开。';
        setError(msg);
        setMicReady(false);
        console.error('[useVoice]', msg);
        return false;
      }

      let stream: MediaStream;
      try {
        stream = await nav.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
          } as MediaTrackConstraints,
        });
      } catch (e: any) {
        const name = e?.name || '';
        let msg = '麦克风启动失败';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          msg = '麦克风权限被拒绝。请在浏览器地址栏左侧允许麦克风后重试。';
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          msg = '未检测到可用麦克风设备。';
        } else if (name === 'NotReadableError') {
          msg = '麦克风被其他程序占用（例如 Teams / Zoom / 录屏软件）。';
        } else if (e instanceof Error) {
          msg = `麦克风启动失败：${e.message}`;
        }
        setError(msg);
        setMicReady(false);
        console.error('[useVoice]', msg, e);
        return false;
      }

      try {
        const mimeType = pickMimeType();
        mimeRef.current = mimeType ?? 'audio/webm';
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128_000 })
          : new MediaRecorder(stream);
        chunksRef.current = [];
        autoFinishRef.current = onAutoFinish ?? null;
        pendingResolveRef.current = null;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onerror = (ev) => {
          console.error('[useVoice] recorder error', ev);
        };

        recorder.onstop = () => {
          clearTimer();
          const blob = new Blob(chunksRef.current, {
            type: mimeRef.current || recorder.mimeType || 'audio/webm',
          });
          recorder.stream.getTracks().forEach((t) => t.stop());
          mediaRecorderRef.current = null;
          setIsRecording(false);
          setMicReady(false);
          console.log(
            `[useVoice] recording stopped, size=${blob.size} bytes, type=${blob.type}`
          );

          const manualResolve = pendingResolveRef.current;
          pendingResolveRef.current = null;
          if (manualResolve) {
            manualResolve(blob);
            return;
          }
          // 自动结束路径（超时）：把 blob 丢给注册方
          const autoCb = autoFinishRef.current;
          autoFinishRef.current = null;
          if (autoCb) {
            try {
              void autoCb(blob);
            } catch (err) {
              console.error('[useVoice] autoFinish handler threw', err);
            }
          }
        };

        recorder.start(500);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setMicReady(true);

        timerRef.current = setTimeout(() => {
          if (recorder.state === 'recording') {
            console.log('[useVoice] max duration reached, auto-stopping');
            recorder.stop();
          }
        }, CONFIG.maxRecordingMs);

        console.log(
          `[useVoice] recording started, mime=${mimeRef.current}, tracks=${stream.getAudioTracks().length}`
        );
        return true;
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        const msg = e instanceof Error ? e.message : 'MediaRecorder 初始化失败';
        setError(msg);
        setMicReady(false);
        console.error('[useVoice]', msg);
        return false;
      }
    },
    [clearTimer, setMicReady]
  );

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== 'recording') {
        // 已经自动停止但没被 autoFinish 处理 → 返回 null，调用方应在注册 autoFinish 时处理
        setIsRecording(false);
        resolve(null);
        return;
      }
      pendingResolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
  };
}
