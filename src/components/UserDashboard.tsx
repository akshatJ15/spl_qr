import React, { useState, useEffect, useCallback } from 'react';
import { 
  QrCode, 
  History, 
  Sparkles, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Award, 
  Phone, 
  User, 
  RefreshCw, 
  Download,
  Smartphone,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QrScannerModal from './QrScannerModal';
import { apiUrl } from '../utils/api';

interface UserProfile {
  _id: string;
  name: string;
  phone: string;
  points: number;
}

interface ScanHistoryItem {
  uid: string;
  points: number;
  claimedAt: string;
  claimedBy: string;
  used: boolean;
}

interface UserDashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
}

export default function UserDashboard({ user, onLogout, onUpdateUser }: UserDashboardProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan');
  
  // History State
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Scan Action Feedback States
  const [claimStatus, setClaimStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
    pointsAdded?: number;
    tokenUid?: string;
  }>({ type: 'idle' });

  // Fetch History
  const fetchHistory = useCallback(async () => {
    const token = localStorage.getItem('clientToken');
    if (!token) return;

    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await fetch(apiUrl('/api/client/history'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server response error (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch scan history.');
      }

      setHistory(data.history || []);
    } catch (err: unknown) {
      console.error('Error fetching history:', err);
      const msg = err instanceof Error ? err.message : 'Could not load history.';
      setHistoryError(msg);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch User Profile to keep points synced
  const syncProfile = useCallback(async () => {
    const token = localStorage.getItem('clientToken');
    if (!token) return;

    try {
      const response = await fetch(apiUrl('/api/client/profile'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        onUpdateUser(data.user);
        localStorage.setItem('clientUser', JSON.stringify(data.user));
      }
    } catch {
      // Ignore background sync error
    }
  }, [onUpdateUser]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Handle Token Scan Callback
  const handleScanSuccess = async (scannedToken: string) => {
    setIsScannerOpen(false);
    setClaimStatus({ type: 'loading', message: 'Validating token...' });

    const clientToken = localStorage.getItem('clientToken');
    if (!clientToken) {
      setClaimStatus({
        type: 'error',
        message: 'Session expired. Please sign in again.'
      });
      return;
    }

    try {
      // 1. Check Token Status first
      const checkRes = await fetch(apiUrl(`/api/public/check-token/${scannedToken}`));
      const checkRaw = await checkRes.text();
      let checkData;
      try {
        checkData = JSON.parse(checkRaw);
      } catch {
        throw new Error('Server returned invalid response');
      }

      if (!checkRes.ok || !checkData.valid) {
        setClaimStatus({
          type: 'error',
          message: checkData.message || checkData.error || 'This QR code has already been claimed or is invalid.',
          tokenUid: scannedToken
        });
        return;
      }

      // 2. Claim the active Token
      setClaimStatus({ type: 'loading', message: `Active token verified (${checkData.points} pts)! Adding to balance...` });

      const claimRes = await fetch(apiUrl('/api/client/claim-token'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clientToken}`
        },
        body: JSON.stringify({ uid: scannedToken })
      });

      const claimRaw = await claimRes.text();
      let claimData;
      try {
        claimData = JSON.parse(claimRaw);
      } catch {
        throw new Error('Failed to parse claim response.');
      }

      if (!claimRes.ok) {
        setClaimStatus({
          type: 'error',
          message: claimData.error || 'Failed to claim points.',
          tokenUid: scannedToken
        });
        return;
      }

      // 3. Success! Update local points and profile
      const pointsAdded = claimData.pointsClaimed || checkData.points;
      const newTotal = claimData.newTotal ?? (user.points + pointsAdded);

      const updated = { ...user, points: newTotal };
      onUpdateUser(updated);
      localStorage.setItem('clientUser', JSON.stringify(updated));

      setClaimStatus({
        type: 'success',
        pointsAdded,
        tokenUid: scannedToken,
        message: `Successfully credited ${pointsAdded} points to your account!`
      });

      // Refresh history if history was viewed
      fetchHistory();
    } catch (err: unknown) {
      console.error('Scan claim error:', err);
      const msg = err instanceof Error ? err.message : 'Error processing QR claim.';
      setClaimStatus({ type: 'error', message: msg, tokenUid: scannedToken });
    }
  };

  const triggerApkDownload = () => {
    const link = document.createElement('a');
    link.href = '/download-apk';
    link.download = 'QR-Incentive-Rewards.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 px-3 sm:px-4 pb-12">
      
      {/* Subtle, beautiful top APK Banner */}
      <div className="w-full bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-100/80 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 leading-tight">Get Android App</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">Fast 1-tap scanning & instant benefits</p>
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

      {/* User Header Profile Card */}
      <div className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-blue-500/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight flex items-center gap-1.5">
                {user.name}
              </h2>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-gray-400" />
                {user.phone}
              </p>
            </div>
          </div>

          <button
            id="user-logout-btn"
            onClick={onLogout}
            className="p-2.5 sm:px-3.5 sm:py-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-gray-100 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Balance Highlight Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-5 sm:p-6 flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <span className="text-xs uppercase font-medium tracking-wider text-blue-200">Current Balance</span>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 flex items-baseline gap-1.5">
              <span>{user.points}</span>
              <span className="text-xs font-semibold text-blue-300 uppercase">Points</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">₹ {user.points} equivalent redeemable</p>
          </div>
          <div className="p-3 bg-blue-500/20 text-blue-300 rounded-2xl border border-blue-400/20">
            <Award className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Action Navigation Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-gray-100/80 p-1.5 rounded-2xl">
        <button
          id="tab-scanner-btn"
          onClick={() => setActiveTab('scan')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'scan'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Scan Token</span>
        </button>

        <button
          id="tab-history-btn"
          onClick={() => setActiveTab('history')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Scan History</span>
        </button>
      </div>

      {/* Main Tab Views */}
      <AnimatePresence mode="wait">
        {activeTab === 'scan' ? (
          <motion.div
            key="scan-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            {/* Status / Claim Result Banners */}
            {claimStatus.type === 'loading' && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-blue-800">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-medium">{claimStatus.message}</span>
              </div>
            )}

            {claimStatus.type === 'success' && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 sm:p-6 text-emerald-900 shadow-xs flex flex-col items-center text-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-900">+{claimStatus.pointsAdded} Points Added!</h3>
                  <p className="text-xs text-emerald-700 mt-1 max-w-sm">
                    {claimStatus.message}
                  </p>
                  {claimStatus.tokenUid && (
                    <span className="inline-block mt-2 font-mono text-[11px] bg-emerald-100/80 px-2 py-0.5 rounded text-emerald-800">
                      Token: {claimStatus.tokenUid.slice(0, 8)}...
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setClaimStatus({ type: 'idle' })}
                  className="mt-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </motion.div>
            )}

            {claimStatus.type === 'error' && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-rose-50 border border-rose-200 rounded-3xl p-5 sm:p-6 text-rose-900 shadow-xs flex flex-col items-center text-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-900">QR Code Inactive / Already Claimed</h3>
                  <p className="text-xs text-rose-700 mt-1 max-w-sm">
                    {claimStatus.message}
                  </p>
                </div>
                <button
                  onClick={() => setClaimStatus({ type: 'idle' })}
                  className="mt-1 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Try Another QR
                </button>
              </motion.div>
            )}

            {/* Prominent Scan Action Card */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-sm">
              <div className="w-20 h-20 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100 shadow-inner">
                <QrCode className="w-10 h-10" />
              </div>

              <h3 className="text-xl font-bold text-gray-900">Scan Incentive Token</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                Point your camera at the physical QR code sticker on the package to instantly claim your points.
              </p>

              <button
                id="open-scanner-action-btn"
                onClick={() => {
                  setClaimStatus({ type: 'idle' });
                  setIsScannerOpen(true);
                }}
                className="mt-6 w-full max-w-sm py-4 px-6 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-bold text-base shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <QrCode className="w-5 h-5" />
                <span>Open QR Scanner</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Claimed QR Records ({history.length})
              </span>
              <button
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer p-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="bg-white border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-500">Loading your scan logs...</p>
              </div>
            ) : historyError ? (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{historyError}</span>
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-2">
                <div className="p-3 bg-gray-50 text-gray-400 rounded-2xl">
                  <History className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-gray-800 text-sm">No Scans Recorded Yet</h4>
                <p className="text-xs text-gray-500 max-w-xs">
                  Whenever you scan an active QR token code, it will be permanently recorded in this ledger.
                </p>
                <button
                  onClick={() => setActiveTab('scan')}
                  className="mt-3 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Scan First QR Now
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {history.map((item, idx) => (
                  <div
                    key={item.uid || idx}
                    className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        +{item.points}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-800">
                            {item.uid ? `${item.uid.slice(0, 8)}...` : 'QR TOKEN'}
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            Claimed
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {item.claimedAt
                              ? new Date(item.claimedAt).toLocaleString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-extrabold text-emerald-600">+{item.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Camera Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
