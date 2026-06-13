import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getHistory()
      .then(setHistory)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const statusColors = {
    active: 'bg-emerald-500/20 text-emerald-400',
    away: 'bg-amber-500/20 text-amber-400',
    liveness_pending: 'bg-orange-500/20 text-orange-400',
    ended: 'bg-slate-500/20 text-slate-400',
    abandoned: 'bg-red-500/20 text-red-400',
  };

  function formatDuration(checkin, checkout) {
    if (!checkout) return '—';
    const ms = new Date(checkout) - new Date(checkin);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Usage History</h1>
          <p className="text-slate-400 text-sm mt-1">Your past desk sessions</p>
        </div>
        {history.length > 0 && (
          <span className="text-sm text-slate-500">{history.length} session{history.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm">Loading history...</p>
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">No session history yet</p>
          <p className="text-slate-500 text-sm mt-1">Check in to a desk to get started</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-3 px-3">Desk</th>
                <th className="text-left py-3 px-3">Zone</th>
                <th className="text-left py-3 px-3">Check-in</th>
                <th className="text-left py-3 px-3">Check-out</th>
                <th className="text-left py-3 px-3">Duration</th>
                <th className="text-left py-3 px-3">Status</th>
                <th className="text-left py-3 px-3">End Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-medium text-emerald-400">{s.desk_code}</td>
                  <td className="py-3 px-3 text-slate-300">{s.zone_name}</td>
                  <td className="py-3 px-3 text-slate-400">{new Date(s.checkin_time).toLocaleString()}</td>
                  <td className="py-3 px-3 text-slate-400">{s.checkout_time ? new Date(s.checkout_time).toLocaleString() : <span className="text-emerald-400 text-xs font-medium">Active</span>}</td>
                  <td className="py-3 px-3 text-slate-400">{formatDuration(s.checkin_time, s.checkout_time)}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs capitalize font-medium ${statusColors[s.status] || 'bg-slate-700 text-slate-300'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-xs">{s.end_reason ? s.end_reason.replace(/_/g, ' ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
