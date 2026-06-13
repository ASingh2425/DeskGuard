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

export default function DeskMap({ desks, selectedDesk, onSelectDesk, floor }) {
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
                x={desk.x}
                y={desk.y}
                width={desk.width}
                height={desk.height}
                rx="6"
                fill={color}
                fillOpacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? '#fff' : color}
                strokeWidth={isSelected ? 3 : 1}
              />
              <text
                x={desk.x + desk.width / 2}
                y={desk.y + desk.height / 2 - 4}
                textAnchor="middle"
                fill="#fff"
                fontSize="11"
                fontWeight="700"
                pointerEvents="none"
              >
                {desk.deskCode}
              </text>
              {desk.occupant && (
                <text
                  x={desk.x + desk.width / 2}
                  y={desk.y + desk.height / 2 + 10}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="9"
                  opacity="0.9"
                  pointerEvents="none"
                >
                  {desk.occupant.initials}
                </text>
              )}
            </g>
          );
        })}

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
