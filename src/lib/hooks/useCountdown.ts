import { useEffect, useState, useCallback } from 'react';

interface UseCountdownReturn {
  seconds: number;
  formatTime: () => string;
  isExpired: boolean;
  reset: (newSeconds?: number) => void;
}

/**
 * Countdown timer hook
 * @param initialSeconds - Initial countdown time in seconds
 * @returns Object with seconds, formatTime function, isExpired flag, and reset function
 * @example
 * const { seconds, formatTime, isExpired, reset } = useCountdown(180);
 * // formatTime() returns "03:00", "02:59", ... "00:00"
 */
export function useCountdown(initialSeconds: number): UseCountdownReturn {
  const [endTime, setEndTime] = useState(() => Date.now() + initialSeconds * 1000);
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSeconds(remaining);
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 100);

    return () => clearInterval(timer);
  }, [endTime]);

  const formatTime = useCallback((): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [seconds]);

  const reset = useCallback((newSeconds?: number): void => {
    const duration = newSeconds ?? initialSeconds;
    setEndTime(Date.now() + duration * 1000);
  }, [initialSeconds]);

  return {
    seconds,
    formatTime,
    isExpired: seconds <= 0,
    reset,
  };
}
