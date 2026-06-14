const COLOR_THRESHOLDS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

function getBarColor(pct) {
  if (pct < 60) return COLOR_THRESHOLDS.green;
  if (pct < 85) return COLOR_THRESHOLDS.amber;
  return COLOR_THRESHOLDS.red;
}

function getTextColor(pct) {
  if (pct < 60) return 'text-emerald-400';
  if (pct < 85) return 'text-amber-400';
  return 'text-red-400';
}

function BarRow({ label, occupied, total }) {
  const pct = total === 0 ? 0 : Math.round((occupied / total) * 100);
  const barColor = getBarColor(pct);
  const textColor = getTextColor(pct);

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-400 truncate flex-shrink-0" title={label}>
        {label}
      </span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-fill transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-10 text-right flex-shrink-0 ${textColor}`}>
        {occupied}/{total}
      </span>
    </div>
  );
}

export default function OccupancyBar({ desks }) {
  if (!desks || desks.length === 0) return null;

  // Group by zone
  const zones = {};
  for (const desk of desks) {
    const zone = desk.zoneName || 'Unknown';
    if (!zones[zone]) zones[zone] = { occupied: 0, total: 0 };
    zones[zone].total++;
    if (desk.status !== 'free' && desk.status !== 'maintenance') {
      zones[zone].occupied++;
    }
  }

  // Total
  const totalDesks = desks.length;
  const totalOccupied = desks.filter(
    (d) => d.status !== 'free' && d.status !== 'maintenance'
  ).length;
  const totalPct = totalDesks === 0 ? 0 : Math.round((totalOccupied / totalDesks) * 100);
  const totalBarColor = getBarColor(totalPct);
  const totalTextColor = getTextColor(totalPct);

  return (
    <div className="card p-4 mb-4">
      {/* Overall header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Occupancy</h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          totalPct < 60
            ? 'bg-emerald-500/15 text-emerald-400'
            : totalPct < 85
            ? 'bg-amber-500/15 text-amber-400'
            : 'bg-red-500/15 text-red-400'
        }`}>
          {totalPct}% full
        </span>
      </div>

      {/* Overall bar */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
        <span className="w-28 text-xs text-slate-300 font-semibold flex-shrink-0">All floors</span>
        <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full progress-fill transition-all duration-700 ${totalBarColor}`}
            style={{ width: `${totalPct}%` }}
          />
        </div>
        <span className={`text-sm font-bold w-10 text-right flex-shrink-0 ${totalTextColor}`}>
          {totalOccupied}/{totalDesks}
        </span>
      </div>

      {/* Per-zone rows */}
      <div className="space-y-2">
        {Object.entries(zones).map(([zoneName, { occupied, total }]) => (
          <BarRow key={zoneName} label={zoneName} occupied={occupied} total={total} />
        ))}
      </div>
    </div>
  );
}
