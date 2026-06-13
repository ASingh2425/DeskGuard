import { useEffect } from 'react';

export default function NotificationBanner({ notifications, onDismiss }) {
  // Auto-dismiss notifications after 8 seconds
  useEffect(() => {
    if (!notifications.length) return;
    const timers = notifications.map((n) =>
      setTimeout(() => onDismiss(n.id), 8000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, onDismiss]);

  if (!notifications.length) return null;

  const typeStyles = {
    away_reminder: 'border-amber-500/60 bg-amber-500/10 text-amber-300',
    liveness_prompt: 'border-orange-500/60 bg-orange-500/10 text-orange-300',
    session_ended: 'border-red-500/60 bg-red-500/10 text-red-300',
  };

  const typeIcons = {
    away_reminder: '⏰',
    liveness_prompt: '👋',
    session_ended: '🔔',
  };

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.slice(0, 3).map((n) => (
        <div
          key={n.id}
          className={`border rounded-xl p-4 shadow-xl backdrop-blur-sm fade-in ${typeStyles[n.type] || 'border-slate-600/60 bg-slate-800 text-slate-300'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5 shrink-0">{typeIcons[n.type] || '📢'}</span>
              <p className="text-sm font-medium">{n.message}</p>
            </div>
            <button
              onClick={() => onDismiss(n.id)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

