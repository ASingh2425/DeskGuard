import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children, admin = false }) {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const links = admin
    ? [
        { to: '/monitor', label: '📡 Monitor' },
        { to: '/admin',   label: '📊 Dashboard' },
      ]
    : [
        { to: '/map',     label: 'Map' },
        { to: '/history', label: 'History' },
      ];

  if (isAdmin && !admin) {
    links.push({ to: '/monitor', label: 'Monitor' });
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to={isAdmin ? '/admin' : '/map'} className="text-xl font-bold text-emerald-400">
              DeskGuard
            </Link>
            <div className="flex gap-1">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    location.pathname === l.to
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline">{user?.name}</span>
            <button onClick={() => { logout(); navigate('/login'); }} className="text-sm text-slate-400 hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
