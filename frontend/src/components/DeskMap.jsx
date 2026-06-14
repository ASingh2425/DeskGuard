import { useState, useEffect } from 'react';

const STATUS_COLORS = {
  free: '#22c55e',
  occupied: '#ef4444',
  away: '#eab308',
  abandoned: '#6b7280',
  maintenance: '#9ca3af',
};

const STATUS_LABELS = {
  free: 'Free',
  occupied: 'Occupied',
  away: 'Away',
  abandoned: 'Abandoned',
  maintenance: 'Maintenance',
};

function formatAwayRemaining(awayStart) {
  const ms = 20 * 60 * 1000 - (Date.now() - new Date(awayStart));
  if (ms <= 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatExpiry(expiresAt) {
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return '0:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

export default function DeskMap({ desks, selectedDesk, onSelectDesk, floor }) {
  // Tick every 10s so time pills refresh smoothly
  const [, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const floorDesks = desks.filter((d) => d.floor === floor);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
      <svg
        viewBox="0 0 500 320"
        className="w-full h-auto touch-none"
        style={{ minHeight: '280px' }}
      >
        <rect x="0" y="0" width="500" height="320" fill="#0f172a" rx="8" />

        <text x="250" y="30" textAnchor="middle" fill="#64748b" fontSize="14" fontWeight="600">
          Floor {floor} — Live Seat Map
        </text>

        {floorDesks.map((desk) => {
          const isSelected = selectedDesk?.id === desk.id;
          const color = STATUS_COLORS[desk.status] || STATUS_COLORS.free;
          const hasTags = Array.isArray(desk.tags)
            ? desk.tags.length > 0
            : typeof desk.tags === 'string' && desk.tags.trim() !== '';
          // Support both xCoord/yCoord (API) and x/y (legacy)
          const dx = desk.xCoord ?? desk.x ?? 0;
          const dy = desk.yCoord ?? desk.y ?? 0;
          const dw = desk.width ?? 60;
          const dh = desk.height ?? 40;

          return (
            <g
              key={desk.id}
              onClick={() => onSelectDesk(desk)}
              className={`cursor-pointer ${
                desk.status === 'away' ? 'desk-away-pulse' :
                desk.status === 'liveness_pending' ? 'desk-liveness-pulse' : ''
              }`}
              style={{ transition: 'opacity 0.2s' }}
            >
              <rect
                x={dx}
                y={dy}
                width={dw}
                height={dh}
                rx="6"
                fill={color}
                fillOpacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? '#fff' : color}
                strokeWidth={isSelected ? 3 : 1}
              />

              {/* Desk code label */}
              <text
                x={dx + dw / 2}
                y={dy + dh / 2 - (desk.occupantName || desk.expiresAt || desk.awayStart ? 5 : 0)}
                textAnchor="middle"
                fill="#fff"
                fontSize="11"
                fontWeight="700"
                pointerEvents="none"
              >
                {desk.deskCode}
              </text>

              {/* Occupant initials from new API */}
              {desk.occupantName && (
                <text
                  x={dx + dw / 2}
                  y={dy + dh / 2 + 8}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="9"
                  opacity="0.85"
                  pointerEvents="none"
                >
                  {desk.occupantName}
                </text>
              )}

              {/* Time remaining pill */}
              {(desk.expiresAt || desk.awayStart) && (
                <text
                  x={dx + dw / 2}
                  y={dy + dh - 5}
                  textAnchor="middle"
                  fontSize="8"
                  fill="white"
                  opacity="0.9"
                  pointerEvents="none"
                >
                  {desk.status === 'away' && desk.awayStart
                    ? formatAwayRemaining(desk.awayStart)
                    : desk.expiresAt
                    ? formatExpiry(desk.expiresAt)
                    : ''}
                </text>
              )}

              {/* Tag indicator dot (top-right corner) */}
              {hasTags && (
                <circle
                  cx={dx + dw - 5}
                  cy={dy + 5}
                  r="3"
                  fill="#a78bfa"
                  opacity="0.9"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(20, 280)">
          {Object.entries(STATUS_LABELS).map(([status, label], i) => (
            <g key={status} transform={`translate(${i * 95}, 0)`}>
              <rect width="12" height="12" rx="2" fill={STATUS_COLORS[status]} />
              <text x="18" y="10" fill="#94a3b8" fontSize="10">{label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export function DeskTooltip({ desk }) {
  if (!desk) return null;

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{desk.deskCode}</h3>
        <span
          className="px-2 py-1 rounded text-xs font-medium capitalize"
          style={{ backgroundColor: STATUS_COLORS[desk.status] + '33', color: STATUS_COLORS[desk.status] }}
        >
          {desk.status}
        </span>
      </div>
      <p className="text-slate-400 text-sm mb-2">{desk.zoneName} · Floor {desk.floor}</p>
      {desk.occupant && (
        <div className="space-y-1 text-sm">
          <p>Occupant: <span className="text-slate-200">{desk.occupant.initials}</span></p>
          {desk.checkinTime && <p>Since: <span className="text-slate-200">{new Date(desk.checkinTime).toLocaleString()}</span></p>}
          {desk.timeRemaining != null && (
            <p>Time remaining: <span className="text-amber-400 font-medium">
              {Math.floor(desk.timeRemaining / 60)}m {desk.timeRemaining % 60}s
            </span></p>
          )}
        </div>
      )}
      {desk.status === 'free' && (
        <p className="text-emerald-400 text-sm mt-2">Available for check-in</p>
      )}
    </div>
  );
}
