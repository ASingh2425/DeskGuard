import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function CheckInPage() {
  const { deskCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [desk, setDesk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate(`/login?redirect=/checkin/${deskCode}`);
      return;
    }
    api.getDesk(deskCode)
      .then(setDesk)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [deskCode, user, navigate]);

  async function handleCheckIn() {
    setCheckingIn(true);
    setError('');
    try {
      await api.checkIn(deskCode);
      setSuccess(true);
      setTimeout(() => navigate('/map'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-center py-12 px-4">
        <div className="card w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-2">Check In</h1>
          {desk && (
            <>
              <p className="text-3xl font-bold text-emerald-400 mb-1">{desk.deskCode}</p>
              <p className="text-slate-400 mb-6">{desk.zoneName} · Floor {desk.floor}</p>
              <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium mb-6 capitalize ${
                desk.status === 'free' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {desk.status === 'free' ? 'Available' : `Currently ${desk.status}`}
              </div>
            </>
          )}

          {success ? (
            <div className="text-emerald-400">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold">Checked in successfully!</p>
              <p className="text-sm mt-2 text-slate-400">Redirecting to map...</p>
            </div>
          ) : (
            <>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              {desk?.status === 'free' ? (
                <button onClick={handleCheckIn} disabled={checkingIn} className="btn-primary w-full">
                  {checkingIn ? 'Checking in...' : 'Confirm Check-In'}
                </button>
              ) : (
                <button onClick={() => navigate('/map')} className="btn-secondary w-full">
                  View Map
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
