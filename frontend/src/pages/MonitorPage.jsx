import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import Layout from '../components/Layout';

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  free: '#22c55e',
  occupied: '#ef4444',
  away: '#f59e0b',
  liveness_pending: '#f97316',
  abandoned: '#6b7280',
  maintenance: '#475569',
};

const STATUS_BADGE = {
  free: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  occupied: 'bg-red-500/15 text-red-400 border-red-500/25',
  away: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  liveness_pending: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  abandoned: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  maintenance: 'bg-slate-600/15 text-slate-400 border-slate-600/25',
};

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function fmtDuration(ms) {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Monitor Map ─────────────────────────────────────────────────────────────

function MonitorMap({ desks, selectedDesk, onSelect, floor, now }) {
  const floorDesks = desks.filter(d => d.floor === floor);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60">
      <svg viewBox="0 0 500 320" className="w-full h-auto" style={{ minHeight: 260 }}>
        <rect x="0" y="0" width="500" height="320" fill="#0f172a" rx="8" />
        <text x="250" y="26" textAnchor="middle" fill="#64748b" fontSize="13" fontWeight="600">
          Floor {floor} — Live Monitor
        </text>

        {floorDesks.map(desk => {
          const color = STATUS_COLOR[desk.status] || STATUS_COLOR.free;
          const dx = desk.xCoord ?? desk.x ?? 0;
          const dy = desk.yCoord ?? desk.y ?? 0;
          const dw = desk.width ?? 60;
          const dh = desk.height ?? 40;
          const isSelected = selectedDesk?.id === desk.id;
          const isAway = desk.status === 'away' && desk.awayStart;
          const awayMs = isAway ? 20 * 60 * 1000 - (now - new Date(desk.awayStart)) : null;

          return (
            <g key={desk.id} onClick={() => onSelect(desk)} className="cursor-pointer">
              <rect
                x={dx} y={dy} width={dw} height={dh} rx="6"
                fill={color}
                fillOpacity={isSelected ? 1 : 0.8}
                stroke={isSelected ? '#fff' : (isAway ? '#f59e0b' : color)}
                strokeWidth={isSelected ? 3 : (isAway ? 2 : 1)}
                className={isAway ? 'desk-away-pulse' : ''}
              />
              {/* desk code */}
              <text x={dx + dw / 2} y={dy + dh / 2 - (desk.occupantName ? 5 : 2)}
                textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" pointerEvents="none">
                {desk.deskCode}
              </text>
              {/* occupant initials */}
              {desk.occupantName && (
                <text x={dx + dw / 2} y={dy + dh / 2 + 8}
                  textAnchor="middle" fill="#fff" fontSize="9" opacity="0.85" pointerEvents="none">
                  {desk.occupantName}
                </text>
              )}
              {/* away countdown */}
              {isAway && awayMs !== null && (
                <text x={dx + dw / 2} y={dy + dh - 5}
                  textAnchor="middle" fill={awayMs < 5 * 60000 ? '#fca5a5' : '#fde68a'}
                  fontSize="8" fontWeight="bold" pointerEvents="none">
                  ⏰{fmtCountdown(awayMs)}
                </text>
              )}
              {/* expiry for occupied */}
              {desk.status === 'occupied' && desk.expiresAt && (
                <text x={dx + dw / 2} y={dy + dh - 5}
                  textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8" pointerEvents="none">
                  {fmtDuration(new Date(desk.expiresAt) - now)}
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(14,292)">
          {[['free','Free'],['occupied','Occupied'],['away','Away'],['maintenance','Maint.']].map(([s,l],i) => (
            <g key={s} transform={`translate(${i*112},0)`}>
              <rect width="10" height="10" rx="2" fill={STATUS_COLOR[s]} />
              <text x="14" y="9" fill="#94a3b8" fontSize="9">{l}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ── Desk Detail Panel ────────────────────────────────────────────────────────

function DeskDetailPanel({ desk, onFree, onMaintenance, now, freeLoading }) {
  if (!desk) {
    return (
      <div className="card flex flex-col items-center justify-center min-h-[200px] text-center">
        <svg className="w-10 h-10 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
        </svg>
        <p className="text-slate-500 font-medium">Select a desk</p>
        <p className="text-slate-600 text-sm mt-1">Click any desk on the map to view details</p>
      </div>
    );
  }

  const isAway = desk.status === 'away' && desk.awayStart;
  const awayMs = isAway ? 20 * 60 * 1000 - (now - new Date(desk.awayStart)) : null;
  const expiryMs = desk.expiresAt ? new Date(desk.expiresAt) - now : null;
  const elapsedMs = desk.checkinTime ? now - new Date(desk.checkinTime) : null;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">{desk.deskCode}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{desk.zoneName} · Floor {desk.floor}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${STATUS_BADGE[desk.status] || STATUS_BADGE.free}`}>
          {desk.status.replace('_', ' ')}
        </span>
      </div>

      {/* Free desk */}
      {desk.status === 'free' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
          <p className="text-emerald-400 font-semibold">✅ Available</p>
          <p className="text-slate-400 text-sm mt-1">This desk is ready for booking</p>
        </div>
      )}

      {/* Occupied / Away / Liveness */}
      {desk.occupantName && (
        <div className="space-y-3">
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Occupant</span>
              <span className="font-semibold text-white">{desk.occupantName}</span>
            </div>
            {elapsedMs !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Sitting for</span>
                <span className="text-slate-200">{fmtDuration(elapsedMs)}</span>
              </div>
            )}
            {expiryMs !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Booking ends</span>
                <span className={`font-mono font-semibold ${expiryMs < 600000 ? 'text-orange-400' : 'text-slate-200'}`}>
                  {fmtDuration(expiryMs)}
                </span>
              </div>
            )}
          </div>

          {/* Away countdown banner */}
          {isAway && (
            <div className={`rounded-lg p-4 border text-center ${
              awayMs < 5 * 60000
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <p className={`text-sm font-medium mb-1 ${awayMs < 5 * 60000 ? 'text-red-400' : 'text-amber-400'}`}>
                ⚠️ Student is Away
              </p>
              <p className={`text-3xl font-mono font-bold ${awayMs < 5 * 60000 ? 'text-red-300 urgent-pulse' : 'text-amber-300'}`}>
                {fmtCountdown(awayMs)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Desk auto-frees when timer reaches 00:00</p>
            </div>
          )}

          {desk.status === 'liveness_pending' && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
              <p className="text-orange-400 font-semibold">⚡ Liveness Check Pending</p>
              <p className="text-slate-400 text-sm mt-1">Waiting for student to confirm presence</p>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {desk.notes && (
        <div className="bg-slate-800/40 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Note</p>
          <p className="text-slate-300 text-sm">{desk.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {desk.status !== 'free' && desk.status !== 'maintenance' && (
          <button
            onClick={() => onFree(desk.id)}
            disabled={freeLoading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm border border-red-500/40 text-red-400
                       hover:bg-red-500/10 hover:border-red-500/60 transition-all duration-150
                       disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {freeLoading
              ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Freeing…</>
              : <><span>🔓</span> Force Free Desk</>
            }
          </button>
        )}
        <button
          onClick={() => onMaintenance(desk.id, desk.status !== 'maintenance')}
          className="w-full py-2 rounded-lg font-medium text-sm border border-slate-700 text-slate-400
                     hover:bg-slate-800 hover:text-slate-200 transition-all duration-150"
        >
          {desk.status === 'maintenance' ? '✅ Mark Available' : '🔧 Set Maintenance'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const [desks, setDesks] = useState([]);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [floor, setFloor] = useState(1);
  const [freeLoading, setFreeLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const now = useNow();

  const refresh = useCallback(async () => {
    try {
      const data = await api.getDesks();
      setDesks(data);
      // Refresh selected desk from updated data
      setSelectedDesk(prev => prev ? data.find(d => d.id === prev.id) ?? prev : null);
      setMapLoading(false);
    } catch {
      setMapLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const { connected } = useSocket(refresh);

  async function handleFree(deskId) {
    setFreeLoading(true);
    try {
      await api.admin.forceCheckout(deskId);
      await refresh();
      setSelectedDesk(prev => prev?.id === deskId ? desks.find(d => d.id === deskId) ?? null : prev);
    } catch (err) { alert(err.message); }
    setFreeLoading(false);
  }

  async function handleMaintenance(deskId, enable) {
    try {
      await api.admin.setMaintenance(deskId, enable);
      await refresh();
    } catch (err) { alert(err.message); }
  }

  const floors = [...new Set(desks.map(d => d.floor))].sort();

  // Stats
  const freeCount     = desks.filter(d => d.status === 'free').length;
  const occupiedCount = desks.filter(d => d.status === 'occupied').length;
  const awayCount     = desks.filter(d => d.status === 'away').length;
  const abandonedCount = desks.filter(d => d.status === 'abandoned').length;
  const awayDesks     = desks.filter(d => d.status === 'away');

  return (
    <Layout admin>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Live Monitor</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${
              connected
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/15 text-red-400 border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Live updates' : 'Disconnected'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {floors.map(f => (
            <button key={f} onClick={() => setFloor(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                floor === f ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}>
              Floor {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Free', count: freeCount,      color: 'text-emerald-400', dot: 'bg-emerald-400' },
          { label: 'Occupied', count: occupiedCount, color: 'text-red-400',     dot: 'bg-red-400' },
          { label: 'Away',     count: awayCount,    color: 'text-amber-400',   dot: 'bg-amber-400 animate-pulse' },
          { label: 'Abandoned', count: abandonedCount, color: 'text-slate-400', dot: 'bg-slate-500' },
        ].map(({ label, count, color, dot }) => (
          <div key={label} className="card py-3 px-4 flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Map + Detail */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Map */}
        <div className="lg:col-span-2">
          {mapLoading ? (
            <div className="card flex items-center justify-center" style={{ minHeight: 280 }}>
              <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <MonitorMap
              desks={desks}
              selectedDesk={selectedDesk}
              onSelect={setSelectedDesk}
              floor={floor}
              now={now}
            />
          )}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          <DeskDetailPanel
            desk={selectedDesk}
            onFree={handleFree}
            onMaintenance={handleMaintenance}
            now={now}
            freeLoading={freeLoading}
          />
        </div>
      </div>

      {/* Away desks alert list */}
      {awayDesks.length > 0 && (
        <div className="mt-5 card">
          <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Away Desks — Students Not Present
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {awayDesks.map(desk => {
              const ms = desk.awayStart ? 20 * 60 * 1000 - (now - new Date(desk.awayStart)) : null;
              const isUrgent = ms !== null && ms < 5 * 60 * 1000;
              return (
                <div
                  key={desk.id}
                  onClick={() => { setSelectedDesk(desk); setFloor(desk.floor); }}
                  className={`cursor-pointer rounded-lg p-4 border transition-all ${
                    isUrgent
                      ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15'
                      : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{desk.deskCode}</span>
                    <span className={`font-mono text-sm font-bold ${isUrgent ? 'text-red-400 urgent-pulse' : 'text-amber-400'}`}>
                      {ms !== null ? fmtCountdown(ms) : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{desk.zoneName} · {desk.occupantName || 'Unknown'}</p>
                  <button
                    onClick={e => { e.stopPropagation(); handleFree(desk.id); }}
                    className="mt-2 w-full text-xs py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Force Free Now
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Layout>
  );
}
