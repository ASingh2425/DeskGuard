import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import DeskMap, { DeskTooltip } from '../components/DeskMap';
import SessionPanel from '../components/SessionPanel';
import NotificationBanner from '../components/NotificationBanner';
import Layout from '../components/Layout';

export default function MapPage() {
  const [desks, setDesks] = useState([]);
  const [session, setSession] = useState(null);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [floor, setFloor] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [desksData, sessionData] = await Promise.all([
      api.getDesks(),
      api.getActiveSession().catch(() => null),
    ]);
    setDesks(desksData);
    setSession(sessionData);
    setMapLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const { connected, notifications, dismissNotification } = useSocket(refresh);

  async function handleAction(action) {
    setLoading(true);
    try {
      let result;
      switch (action) {
        case 'away': result = await api.markAway(session.id); break;
        case 'back': result = await api.markBack(session.id); break;
        case 'liveness': result = await api.respondLiveness(session.id); break;
        case 'checkout': await api.checkout(); result = null; break;
      }
      setSession(result);
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const floors = [...new Set(desks.map((d) => d.floor))].sort();

  return (
    <Layout>
      <NotificationBanner notifications={notifications} onDismiss={dismissNotification} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Live Library Map</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
              connected
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Live' : 'Disconnected'}
            </span>
            {!mapLoading && (
              <span className="text-xs text-slate-500">
                {desks.filter(d => d.status === 'free').length} of {desks.length} desks available
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                floor === f ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Floor {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {mapLoading ? (
            <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-center" style={{ minHeight: '280px' }}>
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <svg className="w-8 h-8 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm">Loading seat map...</p>
              </div>
            </div>
          ) : (
            <DeskMap
              desks={desks}
              selectedDesk={selectedDesk}
              onSelectDesk={setSelectedDesk}
              floor={floor}
            />
          )}
          <DeskTooltip desk={selectedDesk} />
        </div>

        <div className="space-y-4">
          <SessionPanel
            session={session}
            onAway={() => handleAction('away')}
            onBack={() => handleAction('back')}
            onLiveness={() => handleAction('liveness')}
            onCheckout={() => handleAction('checkout')}
            loading={loading}
          />

          <div className="card">
            <h3 className="font-semibold mb-1">Quick Check-In</h3>
            <p className="text-sm text-slate-400 mb-3">Available desks on Floor {floor}:</p>
            <div className="flex flex-wrap gap-2">
              {desks.filter((d) => d.status === 'free' && d.floor === floor).slice(0, 6).map((d) => (
                <Link
                  key={d.id}
                  to={`/checkin/${d.deskCode}`}
                  className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-600/20 rounded-lg text-sm font-medium hover:bg-emerald-600/30 hover:border-emerald-600/40 transition-colors"
                >
                  {d.deskCode}
                </Link>
              ))}
              {desks.filter((d) => d.status === 'free' && d.floor === floor).length === 0 && (
                <p className="text-slate-500 text-sm">No free desks on this floor</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
