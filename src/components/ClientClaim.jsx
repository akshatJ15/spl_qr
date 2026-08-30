import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import UnifiedAuthScreen from './UnifiedAuthScreen';
import { apiUrl } from '../utils/api';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Smartphone, 
  ChevronRight, 
  LogOut, 
  Award,
  Download,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ClientClaim() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Extract token from URL
  const tokenFromHook = searchParams.get('token');
  const tokenFromUrl = new URLSearchParams(window.location.search).get('token') || 
                       new URLSearchParams(location.search).get('token');
  const token = tokenFromHook || tokenFromUrl || '';

  // Required state variables
  const [step, setStep] = useState('verifying'); // 'verifying', 'ready', 'claiming', 'claimed', 'error'
  const [pointsAvailable, setPointsAvailable] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('clientToken'));
  const [userProfile, setUserProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('clientUser') || 'null');
    } catch {
      return null;
    }
  });

  // 1. Verify token validity on mounting
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setErrorMsg('No verification token provided. Please scan a valid QR code.');
        setStep('error');
        return;
      }

      setStep('verifying');
      setErrorMsg(null);

      try {
        const response = await fetch(apiUrl(`/api/public/check-token/${token}`));
        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
        }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to verify secure QR code.');
        }

        setPointsAvailable(data.points);
        setStep('ready');
      } catch (err) {
        console.error('Verify token failed:', err);
        setErrorMsg(err.message || 'An error occurred during verification.');
        setStep('error');
      }
    };

    verifyToken();
  }, [token]);

  // Sync profile points from database
  useEffect(() => {
    const fetchLatestProfile = async () => {
      const clientToken = localStorage.getItem('clientToken');
      if (!clientToken) return;

      try {
        const response = await fetch(apiUrl('/api/client/profile'), {
          headers: {
            'Authorization': `Bearer ${clientToken}`
          }
        });
        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }

        if (response.ok && data && data.success && data.user) {
          localStorage.setItem('clientUser', JSON.stringify(data.user));
          setUserProfile(data.user);
        } else if (response.status === 401) {
          handleLogout();
        }
      } catch (err) {
        console.error('Failed to sync profile with database:', err);
      }
    };

    if (isLoggedIn) {
      fetchLatestProfile();
    }
  }, [isLoggedIn]);

  const handleLoginSuccess = (user, token) => {
    localStorage.setItem('clientToken', token);
    localStorage.setItem('clientUser', JSON.stringify(user));
    setIsLoggedIn(true);
    setUserProfile(user);
    setStep('ready');
  };

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientUser');
    setIsLoggedIn(false);
    setUserProfile(null);
    setStep('ready');
  };

  // Perform atomic points claiming
  const handleClaimPoints = async () => {
    if (step === 'claiming') return;
    setStep('claiming');
    setErrorMsg(null);

    const clientToken = localStorage.getItem('clientToken');
    if (!clientToken) {
      setErrorMsg('User authentication is missing. Please log in before claiming.');
      setStep('error');
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/client/claim-token'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clientToken}`
        },
        body: JSON.stringify({ uid: token }),
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Your session has expired. Please sign in again.');
        }
        throw new Error(data.error || 'Failed to claim token points.');
      }

      setStep('claimed');

      const currentProfile = { ...userProfile };
      if (currentProfile) {
        currentProfile.points = data.newTotal !== undefined ? Number(data.newTotal) : (currentProfile.points || 0) + Number(pointsAvailable);
        localStorage.setItem('clientUser', JSON.stringify(currentProfile));
        setUserProfile(currentProfile);
      }
    } catch (err) {
      console.error('Points Claiming Failure:', err);
      setErrorMsg(err.message || 'Database capture failed during claim pipeline.');
      setStep('error');
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center">
      
      {/* Verified Points Header Pill */}
      {step !== 'error' && (
        <div className="text-center mb-3">
          <span className="inline-block px-3 py-1 bg-amber-50 border border-amber-200/60 text-amber-800 rounded-full text-[10px] font-extrabold tracking-wider uppercase mb-1.5">
            AUTHENTICATION REQUIRED
          </span>
          <h2 className="text-sm sm:text-base font-bold text-brand-charcoal">
            We verified <span className="text-blue-600 font-extrabold">{pointsAvailable || 10} points</span> waiting!
          </h2>
        </div>
      )}

      {/* Rendering Auth Form or Logged-in State */}
      <AnimatePresence mode="wait">
        
        {/* VERIFYING */}
        {step === 'verifying' && (
          <motion.div
            key="verifying"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full bg-white border border-gray-100 rounded-3xl shadow-sm p-8 flex flex-col items-center justify-center text-center space-y-4"
          >
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-charcoal">Verifying secure token...</h3>
              <p className="text-xs text-gray-400 mt-1">Connecting to rewards system.</p>
            </div>
          </motion.div>
        )}

        {/* ERROR STATE */}
        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full bg-white border border-gray-100 rounded-3xl shadow-sm p-6 flex flex-col items-center justify-center text-center"
          >
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center border border-red-100 shadow-xs mb-4">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 w-full">
              <h3 className="text-sm font-bold text-brand-charcoal">QR Code Inactive / Already Claimed</h3>
              <p className="text-xs text-red-600 mt-1 font-medium">
                {errorMsg || 'This QR token has already been claimed or is invalid.'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-brand-charcoal font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* READY: AUTH PENDING (Pure Clean Form Matching Original UI) */}
        {(step === 'ready' || step === 'claiming') && !isLoggedIn && (
          <motion.div
            key="auth-pending"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full"
          >
            <UnifiedAuthScreen 
              initialRole="user"
              onUserLoginSuccess={handleLoginSuccess}
              onAdminLoginSuccess={() => {}}
            />
          </motion.div>
        )}

        {/* READY: LOGGED IN */}
        {(step === 'ready' || step === 'claiming') && isLoggedIn && (
          <motion.div
            key="claim-ready"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full bg-white border border-gray-100 rounded-3xl shadow-sm p-6 sm:p-7 flex flex-col items-center justify-center text-center"
          >
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-xs border border-blue-100 mb-3">
              <Award className="w-8 h-8" />
            </div>

            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 w-full shadow-xs">
              <span className="text-xs font-semibold text-brand-charcoal uppercase tracking-wider">
                Points Available
              </span>
              <div className="text-4xl font-extrabold text-blue-900 tracking-tight mt-1">
                {pointsAvailable}
              </div>
            </div>

            {userProfile && (
              <div className="mt-3 flex items-center justify-between w-full bg-slate-50 border border-gray-100 rounded-xl px-3.5 py-2">
                <div className="flex items-center gap-2 text-left">
                  <div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                    {userProfile.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-charcoal block leading-tight">{userProfile.name}</span>
                    <span className="text-[10px] text-brand-charcoal">{userProfile.phone}</span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleClaimPoints}
              disabled={step === 'claiming'}
              id="auth-claim-btn"
              className="mt-5 w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {step === 'claiming' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming Points...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Claim {pointsAvailable} Points Now
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* CLAIMED SUCCESS */}
        {step === 'claimed' && (
          <motion.div
            key="claimed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full bg-white border border-gray-100 rounded-3xl shadow-sm p-6 sm:p-7 flex flex-col items-center justify-center text-center"
          >
            <div className="w-16 h-16 bg-brand-blue-50 text-brand-blue rounded-full flex items-center justify-center shadow-xs border-4 border-brand-blue-50 mb-3">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div className="bg-brand-blue-50 border border-brand-blue-50 rounded-2xl p-5 w-full shadow-xs">
              <span className="inline-block px-3 py-1 bg-brand-blue-50 text-brand-blue rounded-full text-xs font-bold uppercase tracking-wider">
                Points Claimed Successfully
              </span>
              <p className="text-sm font-bold text-brand-charcoal mt-3">
                <strong>+{pointsAvailable}</strong> points added to your balance.
              </p>
              <div className="mt-3 border-t border-brand-blue-50/60 pt-2 flex justify-between items-center text-xs font-medium text-brand-charcoal">
                <span>New Balance:</span>
                <span className="font-bold text-brand-blue">{userProfile?.points ?? pointsAvailable} pts</span>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
