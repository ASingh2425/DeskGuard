import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = isRegister
        ? await register(name, email, password)
        : await login(email, password);

      if (user.role === 'librarian' || user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/map');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-slate-800/40 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-4 shadow-lg shadow-emerald-900/20">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Desk<span className="text-emerald-400">Guard</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Library Seat Booking &amp; Anti-Hoarding System</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl shadow-black/40">
          {/* Tab toggle */}
          <div className="flex rounded-xl bg-slate-800/60 p-1 mb-6 gap-1">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                !isRegister ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                isRegister ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Full Name</label>
                <input
                  id="name"
                  className="input"
                  placeholder="Alex Student"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="you@library.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              id="submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base relative overflow-hidden group"
            >
              <span className={loading ? 'opacity-0' : ''}>
                {isRegister ? 'Create Account' : 'Sign In'}
              </span>
              {loading && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/30">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Demo Accounts</p>
            <div className="space-y-1.5">
              {[
                { email: 'student@library.edu', role: 'Student' },
                { email: 'librarian@library.edu', role: 'Librarian' },
                { email: 'admin@library.edu', role: 'Admin' },
              ].map(({ email: demoEmail, role }) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword('password123');
                    setIsRegister(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-left group"
                >
                  <span className="font-mono">{demoEmail}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    role === 'Admin' ? 'bg-purple-500/20 text-purple-400' :
                    role === 'Librarian' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>{role}</span>
                </button>
              ))}
              <p className="text-xs text-slate-600 mt-2 text-center">All use password: <span className="text-slate-500 font-mono">password123</span></p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          DeskGuard · Library Desk Management System
        </p>
      </div>
    </div>
  );
}
