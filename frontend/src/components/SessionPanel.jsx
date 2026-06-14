import { useState } from 'react';
import { api } from '../api/client';
import { formatDuration } from '../hooks/useSocket';
import SessionCountdown from './SessionCountdown';
import AwayCountdown from './AwayCountdown';

export default function SessionPanel({
  session,
  onAway,
  onBack,
  onLiveness,
  onCheckout,
  onExtend,
  onExpired,
  loading,
}) {
  const [extendLoading, setExtendLoading] = useState(false);
  const [extendError, setExtendError] = useState('');

  if (!session) {
    return (
      <div className="card text-center py-8">
        <p className="text-slate-400">No active session</p>
        <p className="text-sm text-slate-500 mt-2">Click a free desk on the map to book</p>
      </div>
    );
  }

  const statusColors = {
    active: 'text-emerald-400',
    away: 'text-amber-400',
    liveness_pending: 'text-orange-400',
  };

  // Compute remaining ms to decide if extend button shows
  const remainingMs = session.expiresAt ? new Date(session.expiresAt) - Date.now() : null;
  const showExtend = remainingMs != null && remainingMs < 10 * 60 * 1000 && remainingMs > 0;

  async function handleExtend() {
    setExtendLoading(true);
    setExtendError('');
    try {
      await api.extend(session.id);
      onExtend?.();
    } catch (err) {
      setExtendError(err.message || 'Could not extend session');
    } finally {
      setExtendLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Your Session</h2>
        <div className="flex items-center gap-2">
          {session.extendCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
              +{session.extendCount} extended
            </span>
          )}
          <span className={`font-medium capitalize ${statusColors[session.status] || ''}`}>
            {session.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Session Countdown at top for active/liveness_pending */}
      {(session.status === 'active' || session.status === 'liveness_pending') && session.expiresAt && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Time remaining</p>
          <SessionCountdown
            expiresAt={session.expiresAt}
            durationMinutes={session.durationMinutes || 60}
            onExpired={onExpired}
          />
        </div>
      )}

      {/* Booking info */}
      {session.durationMinutes && (
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Booked for {formatDuration(session.durationMinutes * 60)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-500">Desk</p>
          <p className="font-semibold text-lg">{session.deskCode}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-500">Zone</p>
          <p className="font-semibold">{session.zoneName}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-500">Checked in</p>
          <p className="font-semibold">{new Date(session.checkinTime).toLocaleTimeString()}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-500">Away used</p>
          <p className="font-semibold">{session.awayCount} / {session.maxAwayPeriods}</p>
        </div>
      </div>

      {/* Away Countdown Banner */}
      {session.status === 'away' && session.awayStart && (
        <AwayCountdown
          awayStart={session.awayStart}
          awayLimitMinutes={session.awayLimitMinutes || 20}
          onExpired={onExpired}
        />
      )}

      {/* Legacy away fallback (server-side awayRemainingSeconds) */}
      {session.status === 'away' && !session.awayStart && session.awayRemainingSeconds != null && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center">
          <p className="text-amber-400 text-sm">Away timer — return before expiry</p>
          <p className="text-3xl font-bold text-amber-300 mt-1">
            {formatDuration(session.awayRemainingSeconds)}
          </p>
        </div>
      )}

      {session.status === 'liveness_pending' && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <p className="text-orange-400 font-medium">Still here? Confirm your presence!</p>
          <p className="text-sm text-slate-400 mt-1">
            Grace window: {session.livenessGraceMinutes} minutes
          </p>
          <button onClick={onLiveness} disabled={loading} className="btn-primary mt-3 w-full">
            Yes, still here
          </button>
        </div>
      )}

      {session.status === 'active' && session.livenessRemainingSeconds != null && (
        <div className="text-sm text-slate-400 text-center">
          Next liveness check in: {formatDuration(session.livenessRemainingSeconds)}
        </div>
      )}

      {/* Extend button (shown when < 10 min remaining) */}
      {showExtend && (
        <div className="space-y-1">
          <button
            onClick={handleExtend}
            disabled={extendLoading || loading}
            className="w-full py-2 rounded-lg text-sm font-semibold border border-violet-500/40 text-violet-400
                       hover:bg-violet-500/10 hover:border-violet-500/60 transition-all duration-150
                       disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {extendLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : '⏱️'}
            Extend +30 min
          </button>
          {extendError && <p className="text-xs text-red-400 text-center">{extendError}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {session.status === 'active' && (
          <button onClick={onAway} disabled={loading || session.awayCount >= session.maxAwayPeriods} className="btn-warning flex-1">
            I'm Away
          </button>
        )}
        {session.status === 'away' && (
          <button onClick={onBack} disabled={loading} className="btn-primary flex-1">
            I'm Back
          </button>
        )}
        <button onClick={onCheckout} disabled={loading} className="btn-secondary flex-1">
          Check Out
        </button>
      </div>
    </div>
  );
}
