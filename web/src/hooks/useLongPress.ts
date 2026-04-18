import { useRef, useCallback } from 'react';
import { CONFIG } from '../config';

interface UseLongPressOptions {
  onLongPress: () => void;
  onPress?: () => void;
  delay?: number;
}

export function useLongPress({
  onLongPress,
  onPress,
  delay = CONFIG.longPressMs,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);

  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      triggeredRef.current = false;
      timerRef.current = setTimeout(() => {
        triggeredRef.current = true;
        onLongPress();
      }, delay);
    },
    [onLongPress, delay]
  );

  const end = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!triggeredRef.current && onPress) {
        onPress();
      }
    },
    [onPress]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: cancel,
  };
}
