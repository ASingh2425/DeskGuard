import { useState, useEffect, useRef } from 'react';

export default function SessionCountdown({ expiresAt, durationMinutes, onExpired }) {
  const [remaining, setRemaining] = useState(() => new Date(expiresAt) - Date.now());
  const expiredCalled = useRef(false);

  const totalMs = (durationMinutes || 60) * 60 * 1000;

  useEffect(() => {
    expiredCalled.current = false;
    setRemaining(new Date(expiresAt) - Date.now());
  }, [expiresAt]);

  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(expiresAt) - Date.now();
      setRemaining(ms);
      if (ms <= 0 && !expiredCalled.current) {
        expiredCalled.current = true;
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  // Format H:MM:SS or MM:SS
  function format(ms) {
    if (ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const isExpired = remaining <= 0;
  const isUrgent = remaining > 0 && remaining < 2 * 60 * 1000;
  const isWarning = remaining > 0 && remaining < 10 * 60 * 1000;

  const colorClass = isExpired
    ? 'text-red-400'
    : isUrgent
    ? 'text-red-400 urgent-pulse'
    : isWarning
    ? 'text-amber-400'
    : 'text-emerald-400';

  const usedMs = Math.max(0, totalMs - remaining);
  const progressPct = Math.min(100, (usedMs / totalMs) * 100);

  const barColor = isExpired || isUrgent
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {(isWarning || isExpired) && (
          <span className={`w-2 h-2 rounded-full ${isUrgent || isExpired ? 'bg-red-400 urgent-pulse' : 'bg-amber-400 animate-pulse'}`} />
        )}
        <span className={`font-mono text-2xl font-bold ${colorClass}`}>
          {isExpired ? 'Expired' : format(remaining)}
        </span>
        {isWarning && !isExpired && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {isUrgent ? 'Expiring soon!' : 'Low time'}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-fill transition-all duration-1000 ${barColor}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
