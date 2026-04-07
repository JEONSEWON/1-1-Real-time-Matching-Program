'use client';

import { useEffect, useState, useRef } from 'react';

interface TimerProps {
  totalSeconds: number;
  elapsedSeconds: number;
  onExpire?: () => void;
}

export default function Timer({ totalSeconds, elapsedSeconds, onExpire }: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds - elapsedSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    const initial = totalSeconds - elapsedSeconds;
    setRemaining(initial);
    expiredRef.current = false;

    if (initial <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(intervalRef.current!);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [totalSeconds, elapsedSeconds]);

  const progress = (remaining / totalSeconds) * 100;
  const isUrgent = remaining <= 3;

  return (
    <div className="flex items-center gap-3">
      {/* 숫자 */}
      <div
        className={`font-mono font-bold text-3xl tabular-nums w-14 text-right ${
          isUrgent ? 'text-red-400 animate-pulse' : 'text-neon'
        }`}
      >
        {remaining}
      </div>

      {/* 프로그레스바 */}
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-none ${
            isUrgent ? 'bg-red-500' : 'bg-neon'
          } ${isUrgent ? 'animate-pulse-neon' : ''}`}
          style={{ width: `${progress}%`, transition: 'width 1s linear' }}
        />
      </div>
    </div>
  );
}
