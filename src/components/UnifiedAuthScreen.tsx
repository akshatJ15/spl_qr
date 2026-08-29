import React, { useState } from 'react';
import { 
  User, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  Smartphone,
  Gift,
  Download,
  X,
  Sparkles,
  Zap,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { apiUrl } from '../utils/api';

interface UserProfile {
  _id: string;
  name: string;
  phone: string;
  points: number;
}

interface UnifiedAuthScreenProps {
  onUserLoginSuccess: (user: UserProfile, token: string) => void;
  onAdminLoginSuccess: () => void;
  initialRole?: 'user' | 'admin';
}

export default function UnifiedAuthScreen({
  onUserLoginSuccess,
  onAdminLoginSuccess,
  initialRole = 'user'
}: UnifiedAuthScreenProps) {
  const [role, setRole] = useState<'user' | 'admin'>(initialRole);
  
  const [showApkModal, setShowApkModal] = useState(() => {
    return !sessionStorage.getItem('apkPromptShown');
  });

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const [adminPin, setAdminPin] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);

  const closeApkModal = () => {
    sessionStorage.setItem('apkPromptShown', 'true');
    setShowApkModal(false);
  };

  const triggerApkDownload = () => {
    const link = document.createElement('a');
    link.href = '/download-apk';
    link.download = 'QR-Incentive-Rewards.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    closeApkModal();
  };

  const handleUserAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (cleanPhone === '8650124154') {
      toast.error('This number is reserved for Admin. Please use the Admin tab.');
      return;
    }
    setIsSubmittingUser(true);
    try {
      if (authMode === 'signup') {
        const cleanName = fullName.trim();
        if (!cleanName || cleanName.length < 2) {
          toast.error('Please enter your full name to complete registration.');
          setIsSubmittingUser(false);
          return;
        }
        const res = await fetch(apiUrl('/api/client/auth'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, name: cleanName }),
        });
        const rawText = await res.text();
        let data;
        try { data = JSON.parse(rawText); } catch { throw new Error('Invalid server response format'); }
        if (!res.ok) throw new Error(data.error || 'Registration failed.');
        toast.success('Registration successful!');
        onUserLoginSuccess(data.user, data.token);
      } else {
        const res = await fetch(apiUrl('/api/client/login-phone'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone }),
        });
        const rawText = await res.text();
        let data;
        try { data = JSON.parse(rawText); } catch { throw new Error('Invalid server response format'); }
        if (!res.ok) {
          if (data.isNewUser || res.status === 404) {
            toast.error('You need to signup first', { duration: 4000 });
            setAuthMode('signup');
            setIsSubmittingUser(false);
            return;
          }
          throw new Error(data.error || 'Failed to sign in.');
        }
        toast.success('Welcome back!');
        onUserLoginSuccess(data.user, data.token);
      }
    } catch (err: unknown) {
      console.error('User auth error:', err);
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      toast.error(msg);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAdmin(true);
    try {
      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('isAdminAuthenticated', 'true');
        sessionStorage.setItem('adminToken', data.token);
        toast.success('Admin Console Unlocked');
        onAdminLoginSuccess();
      } else {
        toast.error(data.error || 'Invalid Security PIN.');
      }
    } catch (err) {
      toast.error('An error occurred during authentication.');
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 sm:py-8 flex flex-col items-center">
      
      {/* ===== APK DOWNLOAD MODAL ===== */}
      <AnimatePresence>
        {showApkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass-card-elevated relative w-full max-w-sm rounded-[28px] p-7 flex flex-col items-center text-center"
            >
              <button
                onClick={closeApkModal}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100/80 transition-all cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Floating icon */}
              <div className="float w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-lg mb-5" style={{ boxShadow: '0 8px 24px rgba(108,61,209,0.3)' }}>
                <Smartphone className="w-8 h-8" />
              </div>

              <div className="pill-brand px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Faster Experience</span>
              </div>

              <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                Get the App
              </h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed px-2">
                Instant camera scanning, real-time rewards tracking, and 1-tap claiming — all in one lightweight app.
              </p>

              {/* Features mini-grid */}
              <div className="grid grid-cols-3 gap-2.5 mt-5 w-full">
                {[
                  { icon: Zap, label: 'Instant Scan' },
                  { icon: Star, label: 'Track Points' },
                  { icon: Sparkles, label: 'Auto Claim' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 py-2.5 px-2 bg-violet-50/60 rounded-xl border border-violet-100/50">
                    <Icon className="w-4 h-4 text-violet-600" />
                    <span className="text-[10px] font-semibold text-violet-700">{label}</span>
                  </div>
                ))}
              </div>

              <div className="w-full flex flex-col gap-3 mt-6">
                <button
                  onClick={triggerApkDownload}
                  className="btn-primary w-full py-3.5 px-4 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Download className="w-4.5 h-4.5" />
                  <span>Download APK</span>
                </button>

                <button
                  onClick={closeApkModal}
                  className="w-full py-2.5 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  Continue on Website →
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== BRAND HEADER ===== */}
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="inline-flex p-3.5 bg-gradient-to-br from-violet-500 to-violet-700 text-white rounded-2xl shadow-lg mb-4" style={{ boxShadow: '0 8px 24px rgba(108,61,209,0.3)' }}>
          <Gift className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          <span className="gradient-text">QR Rewards</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1.5 font-medium">
          Scan codes · Earn points · Redeem rewards
        </p>
      </motion.div>

      {/* ===== AUTH CARD ===== */}
      <motion.div 
        className="glass-card-elevated w-full rounded-[28px] p-6 sm:p-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        
        {/* Role Toggle */}
        <div className="grid grid-cols-2 gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl mb-7">
          {(['user', 'admin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`relative flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                role === r
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r === 'user' ? <User className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{r === 'user' ? 'User' : 'Admin'}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {role === 'user' ? (
            <motion.div
              key="user-auth"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
            >
              {/* Sign In / Sign Up sub-tabs */}
              <div className="flex mb-6">
                {(['signin', 'signup'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthMode(mode)}
                    className={`relative flex-1 pb-3 text-sm font-semibold transition-colors cursor-pointer ${
                      authMode === mode 
                        ? 'text-violet-600' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                    {authMode === mode && (
                      <motion.div
                        layoutId="auth-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <form onSubmit={handleUserAuth} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-600 flex items-center justify-between">
                    <span>Mobile Number</span>
                    <span className="text-[11px] font-normal text-gray-400">10 digits</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-xs font-bold text-gray-500">+91</span>
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      required
                      className="input-field w-full pl-13 pr-4 py-3.5 text-sm font-medium"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {authMode === 'signup' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col gap-2 overflow-hidden"
                    >
                      <label className="text-xs font-semibold text-gray-600">Full Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required={authMode === 'signup'}
                          className="input-field w-full pl-11 pr-4 py-3.5 text-sm font-medium"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="btn-primary mt-3 w-full py-3.5 px-4 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmittingUser ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.form
              key="admin-auth"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleAdminAuth}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-600 flex items-center justify-between">
                  <span>Security PIN</span>
                  <span className="pill-warning text-[10px] font-bold px-2 py-0.5 rounded-full">Authorized Only</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="••••••"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    required
                    className="input-field w-full pl-11 pr-4 py-3.5 text-sm font-medium tracking-[0.3em]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAdmin}
                className="btn-dark mt-3 w-full py-3.5 px-4 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmittingAdmin ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Unlock Admin Console</span>
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Trust footer */}
      <motion.p 
        className="mt-6 text-[11px] text-gray-400 text-center font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Secured with end-to-end encryption · 256-bit SSL
      </motion.p>
    </div>
  );
}
