import { useState } from 'react';
import { api } from '../api/client';

const TAG_ICONS = {
  power: '🔌',
  window: '🪟',
  silent: '🔇',
  group: '👥',
};

const TAG_LABELS = {
  power: 'Power',
  window: 'Window',
  silent: 'Silent',
  group: 'Group',
};

const DURATION_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '2 hr', value: 120 },
  { label: '3 hr', value: 180 },
  { label: '4 hr', value: 240 },
];

function formatDurationLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hr`;
}

export default function BookingModal({ desk, onClose, onBooked }) {
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!desk) return null;

  const tags = Array.isArray(desk.tags)
    ? desk.tags
    : typeof desk.tags === 'string' && desk.tags
    ? desk.tags.split(',').map((t) => t.trim())
    : [];

  async function handleBook() {
    setLoading(true);
    setError('');
    try {
      await api.checkIn(desk.deskCode, selectedDuration);
      onBooked();
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="slide-in-right fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col
                      bg-slate-900/95 backdrop-blur border-l border-slate-700 shadow-2xl shadow-black/50">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Available</span>
            </div>
            <h2 className="text-3xl font-bold text-white">{desk.deskCode}</h2>
            <p className="text-slate-400 text-sm mt-1">
              {desk.zoneName} &middot; Floor {desk.floor}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Features</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                               bg-slate-800 border border-slate-700 text-slate-200"
                  >
                    <span>{TAG_ICONS[tag.toLowerCase()] || '✨'}</span>
                    <span>{TAG_LABELS[tag.toLowerCase()] || tag}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {desk.notes && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Note</p>
              <p className="text-slate-300 text-sm leading-relaxed">{desk.notes}</p>
            </div>
          )}

          {/* Duration Picker */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Book for</p>

            {/* Preset Buttons */}
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {DURATION_PRESETS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setSelectedDuration(value)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    selectedDuration === value
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 scale-105'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-emerald-600/50 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Custom Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>30 min</span>
                <span className="text-emerald-400 font-semibold text-sm">
                  {formatDurationLabel(selectedDuration)}
                </span>
                <span>4 hr</span>
              </div>
              <input
                type="range"
                min={30}
                max={240}
                step={15}
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Booking Summary */}
          <div className="bg-emerald-600/10 border border-emerald-600/20 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Desk</span>
              <span className="text-white font-semibold">{desk.deskCode}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-slate-400">Duration</span>
              <span className="text-emerald-400 font-semibold">{formatDurationLabel(selectedDuration)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-slate-400">Expires ~</span>
              <span className="text-slate-300 font-medium">
                {(() => {
                  const d = new Date(Date.now() + selectedDuration * 60000);
                  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })()}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800">
          <button
            onClick={handleBook}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-all duration-200
                       bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-lg shadow-emerald-900/40
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Booking…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Book Now · {formatDurationLabel(selectedDuration)}
              </>
            )}
          </button>
          <p className="text-center text-xs text-slate-500 mt-3">
            You can check out early at any time
          </p>
        </div>
      </div>
    </>
  );
}
