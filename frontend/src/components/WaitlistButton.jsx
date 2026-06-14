import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function WaitlistButton({ deskCode, userId }) {
  const [status, setStatus] = useState(null); // null = loading, { joined, position }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.getWaitlist(deskCode)
      .then((data) => {
        if (cancelled) return;
        // data expected: { joined: bool, position: number, total: number }
        const entry = Array.isArray(data)
          ? data.find((e) => String(e.userId) === String(userId))
          : null;
        if (Array.isArray(data)) {
          const pos = data.findIndex((e) => String(e.userId) === String(userId));
          setStatus({ joined: pos >= 0, position: pos >= 0 ? pos + 1 : null, total: data.length });
        } else {
          setStatus(data);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus({ joined: false, position: null, total: 0 });
      });
    return () => { cancelled = true; };
  }, [deskCode, userId]);

  async function handleJoin() {
    setLoading(true);
    setError('');
    try {
      const data = await api.joinWaitlist(deskCode);
      setStatus({ joined: true, position: data?.position ?? 1, total: data?.total ?? 1 });
    } catch (err) {
      setError(err.message || 'Could not join waitlist');
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    setLoading(true);
    setError('');
    try {
      await api.leaveWaitlist(deskCode);
      setStatus({ joined: false, position: null, total: Math.max(0, (status?.total ?? 1) - 1) });
    } catch (err) {
      setError(err.message || 'Could not leave waitlist');
    } finally {
      setLoading(false);
    }
  }

  if (status === null) {
    return (
      <div className="h-9 w-32 rounded-lg bg-slate-800 animate-pulse" />
    );
  }

  return (
    <div className="space-y-1">
      {status.joined ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                           bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <span>#{status.position} in queue</span>
          </span>
          <button
            onClick={handleLeave}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium
                       border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400
                       transition-colors disabled:opacity-50"
          >
            {loading ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : '✕'}
            Leave
          </button>
        </div>
      ) : (
        <button
          onClick={handleJoin}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                     border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60
                     transition-all duration-150 disabled:opacity-50"
        >
          {loading ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
          Join Waitlist
          {status.total > 0 && <span className="text-xs text-amber-300/70">({status.total} waiting)</span>}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
