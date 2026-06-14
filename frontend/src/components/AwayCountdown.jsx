import { useState, useEffect, useRef } from 'react';

export default function AwayCountdown({ awayStart, awayLimitMinutes = 20, onExpired }) {
  const limitMs = awayLimitMinutes * 60 * 1000;
  const [remaining, setRemaining] = useState(() => {
    return new Date(awayStart).getTime() + limitMs - Date.now();
  });
  const expiredCalled = useRef(false);

  useEffect(() => {
    expiredCalled.current = false;
    setRemaining(new Date(awayStart).getTime() + limitMs - Date.now());
  }, [awayStart, limitMs]);

  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(awayStart).getTime() + limitMs - Date.now();
      setRemaining(ms);
      if (ms <= 0 && !expiredCalled.current) {
        expiredCalled.current = true;
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [awayStart, limitMs, onExpired]);

  function format(ms) {
    if (ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const isUrgent = remaining > 0 && remaining < 5 * 60 * 1000;
  const isExpired = remaining <= 0;

  const timeStr = isExpired ? '0:00' : format(remaining);

  return (
    <div
      className={`w-full rounded-xl border px-5 py-4 flex items-center gap-4 transition-all duration-300 ${
        isUrgent || isExpired
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
      }`}
    >
      {/* Icon */}
      <div className={`text-2xl flex-shrink-0 urgent-pulse`}>
        {isUrgent || isExpired ? '🚨' : '⏱️'}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${isUrgent || isExpired ? 'text-red-400' : 'text-amber-400'}`}>
          {isExpired
            ? 'Desk will be freed shortly!'
            : `Your desk will be freed in ${timeStr}!`}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Return and click <strong className="text-slate-200">I'm Back</strong> to keep your seat
        </p>
      </div>

      {/* Countdown badge */}
      <div
        className={`font-mono text-xl font-bold flex-shrink-0 ${
          isUrgent || isExpired ? 'text-red-400 urgent-pulse' : 'text-amber-300'
        }`}
      >
        {timeStr}
      </div>
    </div>
  );
}
