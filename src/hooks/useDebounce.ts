import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to debounce a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to debounce a callback function
 * Prevents rapid successive calls (useful for button clicks)
 */
export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): [(...args: Parameters<T>) => void, boolean] {
  const [isPending, setIsPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (isPending) return;

      setIsPending(true);
      callbackRef.current(...args);

      timeoutRef.current = setTimeout(() => {
        setIsPending(false);
      }, delay);
    },
    [isPending, delay]
  );

  return [debouncedCallback, isPending];
}

/**
 * Hook to prevent double-clicks on async operations
 * Disables the action until the promise resolves
 */
export function useAsyncAction<T extends (...args: unknown[]) => Promise<unknown>>(
  action: T
): [(...args: Parameters<T>) => Promise<void>, boolean] {
  const [isLoading, setIsLoading] = useState(false);
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const wrappedAction = useCallback(
    async (...args: Parameters<T>) => {
      if (isLoading) return;

      setIsLoading(true);
      try {
        await actionRef.current(...args);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  return [wrappedAction, isLoading];
}
