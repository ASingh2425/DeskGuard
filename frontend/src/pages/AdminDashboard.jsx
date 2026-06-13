import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useSocket, formatDuration } from '../hooks/useSocket';
import Layout from '../components/Layout';

const STATUS_BADGE = {
  free: 'bg-emerald-500/20 text-emerald-400',
  occupied: 'bg-red-500/20 text-red-400',
  away: 'bg-amber-500/20 text-amber-400',
  abandoned: 'bg-slate-500/20 text-slate-400',
  maintenance: 'bg-slate-600/20 text-slate-300',
};

export default function AdminDashboard() {
  const [tab, setTab] = useState('desks');
  const [desks, setDesks] = useState([]);
  const [abandoned, setAbandoned] = useState([]);
  const [audit, setAudit] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({ floor: '', status: '' });
  const [alerts, setAlerts] = useState([]);
  const [fetchError, setFetchError] = useState('');

  const refresh = useCallback(async () => {
    const params = {};
    if (filters.floor) params.floor = filters.floor;
    if (filters.status) params.status = filters.status;

    try {
      const [desksData, abandonedData, auditData, analyticsData] = await Promise.all([
        api.admin.getDesks(params),
        api.admin.getAbandoned(),
        api.admin.getAudit(),
        api.admin.getAnalytics(),
      ]);
      setDesks(desksData);
      setAbandoned(abandonedData);
      setAudit(auditData);
      setAnalytics(analyticsData);
      setFetchError('');
    } catch (err) {
      setFetchError(err.message || 'Failed to load dashboard data');
    }
  }, [filters]);

  useEffect(() => { refresh(); }, [refresh]);

  const { notifications } = useSocket(refresh);

  useEffect(() => {
    const abandonmentAlerts = notifications.filter((n) => n.type === 'session_ended');
    if (abandonmentAlerts.length) {
      setAlerts((prev) => [...abandonmentAlerts, ...prev].slice(0, 10));
    }
  }, [notifications]);

  async function handleReset(deskId) {
    try {
      await api.admin.resetDesk(deskId);
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleForceCheckout(deskId) {
    try {
      await api.admin.forceCheckout(deskId);
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleMaintenance(deskId, enabled) {
    try {
      await api.admin.setMaintenance(deskId, enabled);
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleExport() {
    const token = localStorage.getItem('deskguard_token');
    const res = await fetch(api.admin.exportSessions(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sessions-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout admin>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Librarian Dashboard</h1>
        <button onClick={handleExport} className="btn-secondary text-sm">
          Export CSV
        </button>
      </div>

      {fetchError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          ⚠️ {fetchError}
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Utilization" value={`${analytics.utilization?.utilization_rate || 0}%`} sub={`${analytics.utilization?.occupied || 0}/${analytics.utilization?.total || 0} desks`} />
          <StatCard label="Abandonment Rate" value={`${analytics.abandonment?.abandonment_rate || 0}%`} sub={`${analytics.abandonment?.abandoned || 0} abandoned`} />
          <StatCard label="Avg Session" value={`${analytics.avgSessionMinutes || 0} min`} />
          <StatCard label="Peak Hour" value={analytics.peakHours?.[0] ? `${analytics.peakHours[0].hour}:00` : '—'} sub={`${analytics.peakHours?.[0]?.checkins || 0} check-ins`} />
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
        {['desks', 'abandoned', 'audit', 'analytics'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t-lg capitalize font-medium ${
              tab === t ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'desks' && (
        <>
          <div className="flex gap-3 mb-4">
            <select className="input w-auto" value={filters.floor} onChange={(e) => setFilters({ ...filters, floor: e.target.value })}>
              <option value="">All Floors</option>
              <option value="1">Floor 1</option>
              <option value="2">Floor 2</option>
            </select>
            <select className="input w-auto" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All Statuses</option>
              <option value="free">Free</option>
              <option value="occupied">Occupied</option>
              <option value="away">Away</option>
              <option value="abandoned">Abandoned</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left py-3 px-2">Desk</th>
                  <th className="text-left py-3 px-2">Zone</th>
                  <th className="text-left py-3 px-2">Floor</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Occupant</th>
                  <th className="text-left py-3 px-2">Elapsed</th>
                  <th className="text-left py-3 px-2">Remaining</th>
                  <th className="text-left py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {desks.map((d) => (
                  <tr key={d.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-3 px-2 font-medium">{d.deskCode}</td>
                    <td className="py-3 px-2">{d.zoneName}</td>
                    <td className="py-3 px-2">{d.floor}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs capitalize ${STATUS_BADGE[d.status]}`}>{d.status}</span>
                    </td>
                    <td className="py-3 px-2">{d.occupant?.initials || '—'}</td>
                    <td className="py-3 px-2">{formatDuration(d.timeElapsed)}</td>
                    <td className="py-3 px-2">{formatDuration(d.timeRemaining)}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        <button onClick={() => handleReset(d.id)} className="text-xs text-emerald-400 hover:underline">Reset</button>
                        {d.status !== 'free' && (
                          <button onClick={() => handleForceCheckout(d.id)} className="text-xs text-red-400 hover:underline">Force out</button>
                        )}
                        <button onClick={() => handleMaintenance(d.id, d.status !== 'maintenance')} className="text-xs text-slate-400 hover:underline">
                          {d.status === 'maintenance' ? 'Enable' : 'Maint.'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'abandoned' && (
        <div className="card">
          <h3 className="font-semibold mb-4 text-red-400">Abandoned Desk Queue</h3>
          {abandoned.length === 0 ? (
            <p className="text-slate-500">No abandoned desks</p>
          ) : (
            <div className="space-y-3">
              {abandoned.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-4">
                  <div>
                    <p className="font-medium">{d.desk_code}</p>
                    <p className="text-sm text-slate-400">{d.zone_name} · {d.end_reason || 'abandoned'}</p>
                  </div>
                  <button onClick={() => handleReset(d.id)} className="btn-primary text-sm">Reset Desk</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left py-3 px-2">Time</th>
                <th className="text-left py-3 px-2">Action</th>
                <th className="text-left py-3 px-2">Desk</th>
                <th className="text-left py-3 px-2">User</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((log) => (
                <tr key={log.id} className="border-b border-slate-800/50">
                  <td className="py-2 px-2 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="py-2 px-2 capitalize">{log.action.replace(/_/g, ' ')}</td>
                  <td className="py-2 px-2">{log.desk_code || '—'}</td>
                  <td className="py-2 px-2">{log.user_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold mb-4">Peak Hours</h3>
            <div className="space-y-2">
              {analytics.peakHours?.slice(0, 8).map((h) => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="w-12 text-slate-400">{h.hour}:00</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-4">
                    <div
                      className="bg-emerald-500 h-4 rounded-full"
                      style={{ width: `${Math.min(100, (h.checkins / (analytics.peakHours[0]?.checkins || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm w-8 text-right">{h.checkins}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4">Zone Usage</h3>
            <div className="space-y-3">
              {analytics.zoneUsage?.map((z) => (
                <div key={z.name} className="flex justify-between items-center">
                  <span>{z.name}</span>
                  <span className="text-slate-400">{z.sessions} sessions · {z.abandonments} abandoned</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
