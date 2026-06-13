const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
  return localStorage.getItem('deskguard_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (name, email, password) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  me: () => request('/api/auth/me'),

  getDesks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/desks${qs ? `?${qs}` : ''}`);
  },

  getZones: () => request('/api/desks/zones'),

  getDesk: (deskCode) => request(`/api/desks/${deskCode}`),

  getActiveSession: () => request('/api/sessions/active'),

  getHistory: () => request('/api/sessions/history'),

  checkIn: (deskCode) =>
    request('/api/sessions/checkin', { method: 'POST', body: JSON.stringify({ deskCode }) }),

  markAway: (sessionId) =>
    request('/api/sessions/away', { method: 'POST', body: JSON.stringify({ sessionId }) }),

  markBack: (sessionId) =>
    request('/api/sessions/back', { method: 'POST', body: JSON.stringify({ sessionId }) }),

  respondLiveness: (sessionId) =>
    request('/api/sessions/liveness', { method: 'POST', body: JSON.stringify({ sessionId }) }),

  checkout: () => request('/api/sessions/checkout', { method: 'POST', body: JSON.stringify({}) }),

  getConfig: () => request('/api/config'),

  admin: {
    getDesks: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/admin/desks${qs ? `?${qs}` : ''}`);
    },
    getAbandoned: () => request('/api/admin/abandoned'),
    resetDesk: (deskId) => request(`/api/admin/desks/${deskId}/reset`, { method: 'POST' }),
    forceCheckout: (deskId) => request(`/api/admin/desks/${deskId}/force-checkout`, { method: 'POST' }),
    setMaintenance: (deskId, enabled) =>
      request(`/api/admin/desks/${deskId}/maintenance`, { method: 'POST', body: JSON.stringify({ enabled }) }),
    getAudit: () => request('/api/admin/audit'),
    getAnalytics: () => request('/api/admin/analytics'),
    getConfig: () => request('/api/admin/config'),
    updateConfig: (config) =>
      request('/api/admin/config', { method: 'PUT', body: JSON.stringify(config) }),
    exportSessions: () => `${API_URL}/api/admin/export/sessions`,
  },
};
