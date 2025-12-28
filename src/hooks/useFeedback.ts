import { useState, useCallback, useRef, useEffect } from 'react';

type FeedbackType = 'success' | 'error' | 'warning' | 'info';

interface Feedback {
  message: string;
  type: FeedbackType;
}

interface UseFeedbackOptions {
  duration?: number;
  onShow?: (feedback: Feedback) => void;
  onHide?: () => void;
}

interface UseFeedbackReturn {
  feedback: Feedback | null;
  show: (message: string, type?: FeedbackType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  hide: () => void;
  isVisible: boolean;
}

export function useFeedback({
  duration = 3000,
  onShow,
  onHide,
}: UseFeedbackOptions = {}): UseFeedbackReturn {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setFeedback(null);
    onHide?.();
  }, [onHide]);

  const show = useCallback(
    (message: string, type: FeedbackType = 'info') => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const newFeedback = { message, type };
      setFeedback(newFeedback);
      onShow?.(newFeedback);

      // Auto-hide after duration
      if (duration > 0) {
        timeoutRef.current = setTimeout(hide, duration);
      }
    },
    [duration, hide, onShow]
  );

  const showSuccess = useCallback((message: string) => show(message, 'success'), [show]);
  const showError = useCallback((message: string) => show(message, 'error'), [show]);
  const showWarning = useCallback((message: string) => show(message, 'warning'), [show]);
  const showInfo = useCallback((message: string) => show(message, 'info'), [show]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    feedback,
    show,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hide,
    isVisible: feedback !== null,
  };
}
