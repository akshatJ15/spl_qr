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
    fetchHistory();
  }, [fetchHistory]);

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
      const checkRes = await fetchWithTimeout(apiUrl(`/api/public/check-token/${scannedToken}`), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
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
    link.href = '/QuickScan.apk';
    link.download = 'QuickScan.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-10 px-4 sm:px-6 pb-12 mt-6">
      
      {/* ===== LEFT COLUMN: CARDS & ACTIONS ===== */}
      <div className="w-full lg:w-1/3 lg:max-w-[360px] shrink-0 flex flex-col gap-6">
        
        {/* APK BANNER (Compact) */}
        <div className="bg-white rounded-[20px] p-4 flex items-center justify-between shadow-sm border border-[#EFF0F4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#EFF0F4] rounded-xl flex items-center justify-center text-[#11358B]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-[#11358B] leading-tight">Get App</h4>
              <p className="text-sm text-gray-400 mt-0.5 font-medium">1-tap scanning</p>
            </div>
          </div>
          <button
            onClick={triggerApkDownload}
            className="bg-[#6192FC] text-white px-5 py-3 min-h-[44px] rounded-xl text-sm font-bold hover:bg-[#11358B] transition-colors shadow-sm"
          >
            Download
          </button>
        </div>

        {/* BALANCE CARD (Credit Card Proportions) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full min-h-[140px] sm:min-h-[160px] bg-[#11358B] rounded-[24px] p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden shadow-xl"
        >
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#6192FC] opacity-30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <span className="text-xs sm:text-sm uppercase font-bold tracking-widest text-[#EFF0F4]/60">Current Balance</span>
              <div className="text-4xl sm:text-5xl font-extrabold tracking-tight mt-1 text-white">
                <motion.span key={user.points} initial={{ scale: 1.15, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                  {user.points}
                </motion.span>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 flex items-end justify-between w-full mt-2 sm:mt-4">
            <div>
              <span className="text-xs sm:text-sm uppercase font-bold tracking-wider text-[#EFF0F4]/60 block mb-0.5">Redeemable Value</span>
              <p className="text-sm sm:text-base font-bold text-[#C7EF66]">
                ₹{user.points}
              </p>
            </div>
            <Award className="w-8 h-8 text-[#6192FC] opacity-90" />
          </div>
        </motion.div>
      </div>

      {/* ===== RIGHT COLUMN: TRANSACTIONS ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4 sm:mb-5 px-1">
          <h3 className="text-lg sm:text-xl font-extrabold text-[#11358B]">Transactions</h3>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:px-3 text-gray-400 hover:text-[#6192FC] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setClaimStatus({ type: 'idle' });
                setIsScannerOpen(true);
              }}
              className="bg-[#11358B] text-[#C7EF66] hover:bg-[#C7EF66] hover:text-[#11358B] px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Scan QR</span>
              <span className="sm:hidden">Scan</span>
            </button>
          </div>
        </div>

        {/* STATUS BANNERS OVERLAY */}
        <AnimatePresence>
          {claimStatus.type !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full z-10 mb-4 overflow-hidden"
            >
              {claimStatus.type === 'loading' && (
                <div className="bg-[#EFF0F4] rounded-2xl p-4 flex items-center gap-3 text-[#11358B]">
                  <div className="w-5 h-5 border-2 border-[#6192FC] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-semibold">{claimStatus.message}</span>
                </div>
              )}
              {claimStatus.type === 'success' && (
                <div className="bg-[#EFF0F4] rounded-2xl p-6 flex flex-col items-center text-center gap-3 border border-[#C7EF66]/30">
                  <div className="w-12 h-12 rounded-full bg-[#C7EF66] text-[#11358B] flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-[#11358B]">+{claimStatus.pointsAdded} Points!</h3>
                    <p className="text-sm text-[#11358B]/70 mt-1 max-w-sm font-medium">{claimStatus.message}</p>
                  </div>
                  <button onClick={() => setClaimStatus({ type: 'idle' })} className="mt-1 px-6 py-3 min-h-[44px] bg-[#11358B] text-white rounded-xl text-sm font-bold cursor-pointer">
                    Dismiss
                  </button>
                </div>
              )}
              {claimStatus.type === 'error' && (
                <div className="bg-rose-50 rounded-2xl p-6 flex flex-col items-center text-center gap-3 border border-rose-100">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-rose-900">QR Code Invalid</h3>
                    <p className="text-sm text-rose-700 mt-1 max-w-sm font-medium">{claimStatus.message}</p>
                  </div>
                  <button onClick={() => setClaimStatus({ type: 'idle' })} className="mt-1 px-6 py-3 min-h-[44px] bg-rose-600 text-white rounded-xl text-sm font-bold cursor-pointer">
                    Try Another
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-[24px] shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden"
        >
          {isLoadingHistory ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-3 flex-1">
              <div className="w-8 h-8 border-3 border-[#6192FC] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-[#11358B] font-medium">Loading records...</p>
            </div>
          ) : historyError ? (
            <div className="m-6 p-4 rounded-2xl text-xs text-[#11358B] flex items-center gap-2 font-medium bg-[#EFF0F4]">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{historyError}</span>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-3 flex-1">
              <div className="p-4 bg-[#EFF0F4] text-[#11358B] rounded-full mb-2">
                <Coins className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-[#11358B] text-sm">No Transactions Yet</h4>
              <p className="text-xs text-gray-400 max-w-xs font-medium">
                Scan an active QR code to see your reward history appear here.
              </p>
            </div>
          ) : (
            <div className="flex-1 w-full bg-white md:rounded-[24px]">
              <div className="hidden md:grid grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)] border-b border-gray-300 text-[#11358B] text-xs font-bold uppercase tracking-widest bg-[#F8FAFC] divide-x divide-gray-300 rounded-t-[24px]">
                <div className="px-6 py-4">Transaction</div>
                <div className="px-6 py-4">Date</div>
                <div className="px-6 py-4 text-right">Points</div>
                <div className="px-6 py-4 text-right">Status</div>
              </div>
              
              <div className="flex flex-col divide-y divide-gray-300">
                {[...history].sort((a, b) => {
                  if (a.zeroedOut !== b.zeroedOut) {
                    return a.zeroedOut ? 1 : -1;
                  }
                  const dateA = a.claimedAt ? new Date(a.claimedAt).getTime() : 0;
                  const dateB = b.claimedAt ? new Date(b.claimedAt).getTime() : 0;
                  return dateB - dateA;
                }).map((item, idx) => (
                  <div key={item.uid || idx} className={`transition-colors flex flex-col md:grid md:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)] md:items-stretch md:divide-x md:divide-gray-300 ${item.zeroedOut ? 'bg-red-50/10' : 'hover:bg-[#F8FAFC]/60'}`}>
                    
                    {/* Top Row on Mobile, Column 1 on Desktop */}
                    <div className="flex items-start justify-between md:justify-start w-full md:w-auto p-4 md:px-6 md:py-4 md:items-center">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] bg-[#11358B] text-white flex items-center justify-center shrink-0 shadow-sm">
                          <QrCode className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="flex flex-col">
                          <p className="font-extrabold text-[#11358B] text-sm md:text-base leading-tight">LOT {String(item.lotNumber || 0).padStart(3, '0')}</p>
                          <p className="font-mono text-gray-500 text-xs mt-0.5">{item.uid ? item.uid.slice(0, 8) + '...' : 'UNKNOWN'}</p>
                        </div>
                      </div>
                      
                      {/* Points + Status (Mobile Top Right) */}
                      <div className="flex flex-col items-end md:hidden shrink-0">
                        <span className={`font-black text-lg ${item.zeroedOut ? 'text-gray-400 line-through' : 'text-[#6192FC]'}`}>
                          +{item.points}
                        </span>
                        {item.zeroedOut ? (
                           <span className="mt-1 text-[10px] font-bold text-rose-500 uppercase tracking-wider">Withdrawn</span>
                        ) : (
                           <span className="mt-1 text-[10px] font-bold text-[#6B8500] uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row on Mobile, Column 2 on Desktop */}
                    <div className="text-[#11358B] flex md:flex-col items-center md:items-start justify-between md:justify-center text-sm ml-[52px] md:ml-0 mt-1 md:mt-0 px-4 pb-4 md:px-6 md:py-4">
                      <span className="font-bold md:font-extrabold text-gray-700 md:text-[#11358B]">{item.claimedAt ? new Date(item.claimedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                      <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 md:mt-1"><Clock className="w-3.5 h-3.5" /> {item.claimedAt ? new Date(item.claimedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>

                    {/* Desktop Columns 3 & 4 */}
                    <div className="hidden md:flex justify-end items-center font-black text-lg px-6 py-4">
                      <span className={item.zeroedOut ? 'text-gray-400 line-through' : 'text-[#6192FC]'}>
                        +{item.points}
                      </span>
                    </div>
                    <div className="hidden md:flex justify-end items-center px-6 py-4">
                      {item.zeroedOut ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                          Withdrawn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f4fce0] text-[#11358B] border border-[#e5f5b5]">
                          <CheckCircle2 className="w-4 h-4" />
                          Active
                        </span>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
