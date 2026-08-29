import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import ClientLogin from './ClientLogin';
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

  // Popup state on scan
  const [showApkPopup, setShowApkPopup] = useState(false);

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
        // Show gentle, elegant popup modal prompting APK download
        setShowApkPopup(true);
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

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    try {
      setUserProfile(JSON.parse(localStorage.getItem('clientUser') || 'null'));
    } catch {
      setUserProfile(null);
    }
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

  const triggerApkDownload = () => {
    const link = document.createElement('a');
    link.href = '/download-apk';
    link.download = 'QR-Incentive-Rewards.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowApkPopup(false);
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center">
      
      {/* Subtle, beautiful top APK Banner (matching screenshot exactly) */}
      <div className="w-full mb-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-100/80 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 leading-tight">Get Android App</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">Scan anytime & track benefits</p>
          </div>
        </div>
        <button
          onClick={triggerApkDownload}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer shrink-0"
        >
          <span>Get APK</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Verified Points Header Pill */}
      {step !== 'error' && (
        <div className="text-center mb-3">
          <span className="inline-block px-3 py-1 bg-amber-50 border border-amber-200/60 text-amber-800 rounded-full text-[10px] font-extrabold tracking-wider uppercase mb-1.5">
            AUTHENTICATION REQUIRED
          </span>
          <h2 className="text-sm sm:text-base font-bold text-gray-800">
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
              <h3 className="text-sm font-bold text-gray-900">Verifying secure token...</h3>
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
              <h3 className="text-sm font-bold text-gray-900">QR Code Inactive / Already Claimed</h3>
              <p className="text-xs text-red-600 mt-1 font-medium">
                {errorMsg || 'This QR token has already been claimed or is invalid.'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
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
            <ClientLogin onLoginSuccess={handleLoginSuccess} />
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
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                    <span className="text-xs font-bold text-gray-800 block leading-tight">{userProfile.name}</span>
                    <span className="text-[10px] text-gray-500">{userProfile.phone}</span>
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
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-xs border-4 border-emerald-100 mb-3">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 w-full shadow-xs">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
                Points Claimed Successfully
              </span>
              <p className="text-sm font-bold text-gray-800 mt-3">
                <strong>+{pointsAvailable}</strong> points added to your balance.
              </p>
              <div className="mt-3 border-t border-emerald-200/60 pt-2 flex justify-between items-center text-xs font-medium text-gray-600">
                <span>New Balance:</span>
                <span className="font-bold text-emerald-700">{userProfile?.points ?? pointsAvailable} pts</span>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ============================================================ */}
      {/* 🌟 ELEGANT SCAN DOWNLOAD POPUP MODAL */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showApkPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center"
            >
              <button
                onClick={() => setShowApkPopup(false)}
                className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4">
                <Smartphone className="w-7 h-7" />
              </div>

              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full mb-1">
                Fast 1-Tap Experience
              </span>

              <h3 className="text-lg font-bold text-gray-900 mt-1">
                Download Android App
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed px-2">
                Install our official Android app for instant camera scanning, direct cash rewards, and real-time history tracking.
              </p>

              <div className="w-full flex flex-col gap-2.5 mt-5">
                <button
                  onClick={triggerApkDownload}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download App (.apk)</span>
                </button>

                <button
                  onClick={() => setShowApkPopup(false)}
                  className="w-full py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  Continue on Web
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
