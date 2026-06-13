import { formatDuration } from '../hooks/useSocket';

export default function SessionPanel({ session, onAway, onBack, onLiveness, onCheckout, loading }) {
  if (!session) {
    return (
      <div className="card text-center py-8">
        <p className="text-slate-400">No active session</p>
        <p className="text-sm text-slate-500 mt-2">Scan a desk QR code to check in</p>
      </div>
    );
  }

  const statusColors = {
    active: 'text-emerald-400',
    away: 'text-amber-400',
    liveness_pending: 'text-orange-400',
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Your Session</h2>
        <span className={`font-medium capitalize ${statusColors[session.status] || ''}`}>
          {session.status.replace('_', ' ')}
        </span>
      </div>

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

      {session.status === 'away' && session.awayRemainingSeconds != null && (
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
