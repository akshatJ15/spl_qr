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
  Coins,
  TrendingUp,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QrScannerModal from './QrScannerModal';
import { apiUrl, fetchWithTimeout } from '../utils/api';

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
  lotNumber?: number;
  zeroedOut?: boolean;
}

interface UserDashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
}

export default function UserDashboard({ user, onLogout, onUpdateUser }: UserDashboardProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'history'>('scan');
  
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [claimStatus, setClaimStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
    pointsAdded?: number;
    tokenUid?: string;
  }>({ type: 'idle' });

  const fetchHistory = useCallback(async () => {
    const token = localStorage.getItem('clientToken');
    if (!token) return;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await fetchWithTimeout(apiUrl('/api/client/history'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const rawText = await response.text();
      let data;
      try { data = JSON.parse(rawText); } catch { throw new Error(`Server response error (${response.status})`); }
      if (!response.ok) throw new Error(data.error || 'Failed to fetch scan history.');
      setHistory(data.history || []);
    } catch (err: unknown) {
      console.error('Error fetching history:', err);
      const msg = err instanceof Error ? err.message : 'Could not load history.';
      setHistoryError(msg);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const syncProfile = useCallback(async () => {
    const token = localStorage.getItem('clientToken');
    if (!token) return;
    try {
      const response = await fetchWithTimeout(apiUrl('/api/client/profile'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        onUpdateUser(data.user);
        localStorage.setItem('clientUser', JSON.stringify(data.user));
      }
    } catch { /* Ignore background sync error */ }
  }, [onUpdateUser]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchHistory]);

  const handleScanSuccess = async (scannedToken: string) => {
    setIsScannerOpen(false);
    setClaimStatus({ type: 'loading', message: 'Validating token...' });
    const clientToken = localStorage.getItem('clientToken');
    if (!clientToken) {
      setClaimStatus({ type: 'error', message: 'Session expired. Please sign in again.' });
      return;
    }
    try {
      setClaimStatus({ type: 'loading', message: 'Verifying QR code integrity...' });
      const checkRes = await fetchWithTimeout(apiUrl('/api/public/verify-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: scannedToken })
      });
      const checkRaw = await checkRes.text();
      let checkData;
      try { checkData = JSON.parse(checkRaw); } catch { throw new Error('Server returned invalid response'); }
      if (!checkRes.ok || !checkData.valid) {
        setClaimStatus({ type: 'error', message: checkData.message || checkData.error || 'This QR code has already been claimed or is invalid.', tokenUid: scannedToken });
        return;
      }
      setClaimStatus({ type: 'loading', message: `Active token verified (${checkData.points} pts)! Adding to balance...` });
      const claimRes = await fetchWithTimeout(apiUrl('/api/client/claim-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
        body: JSON.stringify({ uid: scannedToken })
      });
      const claimRaw = await claimRes.text();
      let claimData;
      try { claimData = JSON.parse(claimRaw); } catch { throw new Error('Failed to parse claim response.'); }
      if (!claimRes.ok) {
        setClaimStatus({ type: 'error', message: claimData.error || 'Failed to claim points.', tokenUid: scannedToken });
        return;
      }
      const pointsAdded = claimData.pointsClaimed || checkData.points;
      const newTotal = claimData.newTotal ?? (user.points + pointsAdded);
      const updated = { ...user, points: newTotal };
      onUpdateUser(updated);
      localStorage.setItem('clientUser', JSON.stringify(updated));
      setClaimStatus({ type: 'success', pointsAdded, tokenUid: scannedToken, message: `Successfully credited ${pointsAdded} points to your account!` });
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
    link.download = 'MyScan.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 px-3 sm:px-4 pb-12">
      
      {/* ===== APK BANNER ===== */}
      <motion.div 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full rounded-2xl p-3.5 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-brand-blue text-white rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ boxShadow: '0 4px 12px rgba(23, 131, 193,0.25)' }}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-charcoal leading-tight">Get Android App</h4>
            <p className="text-[11px] text-brand-charcoal mt-0.5">1-tap scanning & instant rewards</p>
          </div>
        </div>
        <button
          onClick={triggerApkDownload}
          className="btn-primary px-3.5 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>Get APK</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </motion.div>

      {/* ===== PROFILE CARD ===== */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card-elevated rounded-[28px] p-5 sm:p-6 flex flex-col gap-5"
      >
        {/* User info row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-blue flex items-center justify-center text-white font-bold text-lg shadow-sm" style={{ boxShadow: '0 4px 12px rgba(23, 131, 193,0.25)' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-brand-charcoal leading-tight tracking-tight">
                {user.name}
              </h2>
              <p className="text-xs text-brand-charcoal flex items-center gap-1 mt-0.5 font-medium">
                <Phone className="w-3 h-3 text-gray-400" />
                {user.phone}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-2.5 sm:px-3.5 sm:py-2 text-gray-400 hover:text-brand-blue hover:bg-brand-blue-50 rounded-xl transition-all border border-gray-100/80 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* ===== BALANCE CARD ===== */}
        <div className="balance-card text-white rounded-2xl p-5 sm:p-6 flex items-center justify-between relative z-0">
          <div className="relative z-10">
            <span className="text-[11px] uppercase font-semibold tracking-widest text-brand-blue-50/80">Current Balance</span>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 flex items-baseline gap-2">
              <motion.span
                key={user.points}
                initial={{ scale: 1.15, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {user.points}
              </motion.span>
              <span className="text-xs font-bold text-brand-blue-50/70 uppercase">Points</span>
            </div>
            <p className="text-xs text-brand-blue-50/50 mt-1.5 font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              ₹{user.points} redeemable value
            </p>
          </div>
          <div className="relative z-10 p-3.5 bg-white/10 text-brand-blue-50 rounded-2xl border border-white/10 backdrop-blur-sm">
            <Award className="w-8 h-8" />
          </div>
        </div>
      </motion.div>

      {/* ===== TAB NAVIGATION ===== */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl"
      >
        {([
          { id: 'scan' as const, icon: QrCode, label: 'Scan Token' },
          { id: 'history' as const, icon: History, label: 'History' },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`relative flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === id
                ? 'bg-white text-brand-blue shadow-sm'
                : 'text-brand-charcoal hover:text-brand-charcoal'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </motion.div>

      {/* ===== TAB CONTENT ===== */}
      <AnimatePresence mode="wait">
        {activeTab === 'scan' ? (
          <motion.div
            key="scan-tab"
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            {/* Status Banners */}
            {claimStatus.type === 'loading' && (
              <div className="glass-card rounded-2xl p-4 flex items-center gap-3 text-brand-navy">
                <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold">{claimStatus.message}</span>
              </div>
            )}

            {claimStatus.type === 'success' && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-card-elevated rounded-[24px] p-6 sm:p-7 flex flex-col items-center text-center gap-3 border-brand-blue-50/60"
                style={{ background: 'rgba(23, 131, 193,0.25)', borderColor: 'rgba(23, 131, 193,0.25)' }}
              >
                <div className="w-16 h-16 rounded-full bg-brand-blue-50 text-brand-blue flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-emerald-900">+{claimStatus.pointsAdded} Points!</h3>
                  <p className="text-xs text-brand-blue mt-1 max-w-sm font-medium">{claimStatus.message}</p>
                  {claimStatus.tokenUid && (
                    <span className="inline-block mt-2 font-mono text-[10px] bg-brand-blue-50/80 px-2 py-0.5 rounded-lg text-brand-blue">
                      {claimStatus.tokenUid.slice(0, 12)}...
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setClaimStatus({ type: 'idle' })}
                  className="mt-1 px-5 py-2 bg-brand-blue hover:bg-brand-blue text-white rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-all"
                >
                  Dismiss
                </button>
              </motion.div>
            )}

            {claimStatus.type === 'error' && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-card-elevated rounded-[24px] p-6 sm:p-7 flex flex-col items-center text-center gap-3"
                style={{ background: 'rgba(23, 131, 193,0.25)', borderColor: 'rgba(23, 131, 193,0.25)' }}
              >
                <div className="w-16 h-16 rounded-full bg-brand-blue-50 text-brand-blue flex items-center justify-center">
                  <AlertCircle className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-rose-900">QR Code Invalid</h3>
                  <p className="text-xs text-brand-blue mt-1 max-w-sm font-medium">{claimStatus.message}</p>
                </div>
                <button
                  onClick={() => setClaimStatus({ type: 'idle' })}
                  className="mt-1 px-5 py-2 bg-brand-blue hover:bg-brand-blue text-white rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-all"
                >
                  Try Another QR
                </button>
              </motion.div>
            )}

            {/* ===== SCAN ACTION CARD ===== */}
            <div className="glass-card-elevated rounded-[28px] p-7 sm:p-9 flex flex-col items-center text-center">
              <div className="float w-20 h-20 rounded-3xl bg-brand-blue-50 text-brand-blue flex items-center justify-center mb-5 border border-brand-blue-50/60" style={{ boxShadow: '0 4px 16px rgba(23, 131, 193,0.25) inset, 0 2px 8px rgba(23, 131, 193,0.25)' }}>
                <QrCode className="w-10 h-10" />
              </div>

              <h3 className="text-xl font-extrabold text-brand-charcoal tracking-tight">Scan Incentive Token</h3>
              <p className="text-sm text-brand-charcoal mt-2 max-w-xs leading-relaxed font-medium">
                Point your camera at the QR code on the package to claim your reward points instantly.
              </p>

              <button
                onClick={() => {
                  setClaimStatus({ type: 'idle' });
                  setIsScannerOpen(true);
                }}
                className="btn-primary mt-7 w-full max-w-sm py-4 px-6 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Zap className="w-5 h-5" />
                <span>Open QR Scanner</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                Claimed Records ({history.length})
              </span>
              <button
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="flex items-center gap-1 text-xs text-brand-blue hover:text-brand-navy font-semibold cursor-pointer p-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="glass-card-elevated rounded-[24px] p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-brand-charcoal font-medium">Loading scan history...</p>
              </div>
            ) : historyError ? (
              <div className="glass-card rounded-2xl p-4 text-xs text-brand-blue flex items-center gap-2 font-medium" style={{ background: 'rgba(23, 131, 193,0.25)' }}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{historyError}</span>
              </div>
            ) : history.length === 0 ? (
              <div className="glass-card-elevated rounded-[24px] p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="p-3.5 bg-gray-100 text-gray-400 rounded-2xl">
                  <History className="w-8 h-8" />
                </div>
                <h4 className="font-extrabold text-brand-charcoal text-sm">No Scans Yet</h4>
                <p className="text-xs text-brand-charcoal max-w-xs font-medium">
                  Scan an active QR code to see your reward history here.
                </p>
                <button
                  onClick={() => setActiveTab('scan')}
                  className="mt-2 pill-brand px-4 py-2 rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-all"
                >
                  Scan First QR Now
                </button>
              </div>
            ) : (
              <div className="glass-card-elevated rounded-[24px] overflow-hidden bg-white border border-gray-100 shadow-sm mt-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-brand-charcoal text-xs font-semibold uppercase tracking-wider bg-gray-50/50">
                        <th className="py-4 px-6">QR Token</th>
                        <th className="py-4 px-6">Lot No.</th>
                        <th className="py-4 px-6">Date Scanned</th>
                        <th className="py-4 px-6 text-right">Points</th>
                        <th className="py-4 px-6 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map((item, idx) => (
                        <tr key={item.uid || idx} className={`transition-colors text-sm ${item.zeroedOut ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-gray-50'}`}>
                          <td className="py-4 px-6 font-mono text-brand-charcoal font-medium">
                            {item.uid ? item.uid.slice(0, 8) + '...' : 'UNKNOWN'}
                          </td>
                          <td className="py-4 px-6 font-mono text-brand-charcoal font-bold text-xs">
                            {String(item.lotNumber || 0).padStart(3, '0')}
                          </td>
                          <td className="py-4 px-6 text-brand-charcoal flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {item.claimedAt
                              ? new Date(item.claimedAt).toLocaleString('en-IN', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                })
                              : 'Recently'}
                          </td>
                          <td className={`py-4 px-6 text-right font-extrabold ${item.zeroedOut ? 'text-gray-400 line-through' : 'text-brand-blue'}`}>
                            +{item.points} pts
                          </td>
                          <td className="py-4 px-6 text-right">
                            {item.zeroedOut ? (
                              <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-red-200">
                                Zeroed Out
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-brand-blue-50 text-brand-blue text-[10px] font-bold rounded-full uppercase tracking-wider border border-brand-blue-50">
                                Claimed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
