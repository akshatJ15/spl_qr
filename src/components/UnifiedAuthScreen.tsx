import React, { useState } from 'react';
import { 
  User, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  Smartphone,
  Download,
  X,
  Sparkles,
  Zap,
  Star,
  QrCode
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
    link.download = 'MyScan.apk';
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
    <div className="relative w-full h-full min-h-[500px] flex flex-col md:flex-row bg-auth-bg overflow-hidden font-sans rounded-3xl md:rounded-[40px] shadow-2xl border border-white/10">
      
      {/* ===== APK DOWNLOAD MODAL ===== */}
      <AnimatePresence>
        {showApkModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#11358B]/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white relative w-full max-w-sm rounded-[32px] p-6 md:p-8 flex flex-col items-center text-center shadow-2xl"
            >
              <button
                onClick={closeApkModal}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-auth-bg text-[var(--color-auth-accent)] flex items-center justify-center shadow-[0_8px_30px_rgba(17,53,139,0.3)] mb-4 md:mb-5">
                <Smartphone className="w-8 h-8 md:w-10 md:h-10" />
              </div>

              <div className="bg-auth-accent/20 text-[#6B8500] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Faster Experience
              </div>

              <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                Get the App
              </h3>
              <p className="text-xs md:text-sm text-gray-500 mt-2 leading-relaxed px-2 font-medium">
                Instant camera scanning, real-time rewards tracking, and 1-tap claiming.
              </p>

              <div className="grid grid-cols-3 gap-2 mt-5 w-full">
                {[
                  { icon: Zap, label: 'Fast Scan' },
                  { icon: Star, label: 'Track' },
                  { icon: Sparkles, label: 'Claim' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 py-2 px-2 bg-gray-50 rounded-[16px]">
                    <Icon className="w-4 h-4 text-auth-blue-light" />
                    <span className="text-[10px] md:text-[11px] font-bold text-gray-600">{label}</span>
                  </div>
                ))}
              </div>

              <div className="w-full flex flex-col gap-2.5 mt-6">
                <button
                  onClick={triggerApkDownload}
                  className="w-full py-3.5 px-6 bg-auth-accent text-[var(--color-auth-bg)] hover:bg-[#CDF22B] rounded-full font-black text-sm flex items-center justify-center gap-2.5 cursor-pointer transition-colors active:scale-[0.98]"
                >
                  <Download className="w-4 h-4 md:w-5 md:h-5" />
                  <span>Download APK</span>
                </button>

                <button
                  onClick={closeApkModal}
                  className="w-full py-3 min-h-[44px] text-sm md:text-base font-bold text-gray-400 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  Continue on Website
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===== LEFT BRANDING AREA (Desktop) & TOP AREA (Mobile) ===== */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 md:p-8 overflow-hidden min-h-[35vh] md:min-h-0 md:h-full">
        {/* Abstract Background Orbs for extra flair behind the illustration */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-auth-blue-bright rounded-full blur-[100px] opacity-40 mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-auth-blue-light rounded-full blur-[120px] opacity-30 mix-blend-screen pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center w-full max-w-lg mt-6 md:mt-0"
        >
          {/* Custom Illustration */}
          <div className="w-full max-w-[260px] md:max-w-[280px] lg:max-w-[320px] relative drop-shadow-2xl">
            <img 
              src="/auth_illustration.jpg" 
              alt="Scan and Earn Illustration" 
              className="w-full h-auto object-contain rounded-2xl"
            />
          </div>
        </motion.div>
      </div>

      {/* ===== RIGHT FORM AREA (Desktop) & BOTTOM SHEET (Mobile) ===== */}
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 200, delay: 0.1 }}
        className="w-full bg-white rounded-t-[32px] md:rounded-none md:rounded-l-[40px] p-6 pt-8 pb-12 md:p-8 lg:p-12 flex flex-col md:w-full md:max-w-[420px] lg:max-w-[480px] shrink-0 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] md:shadow-[-20px_0_50px_rgba(0,0,0,0.2)] min-h-[65vh] md:min-h-0 md:h-full relative overflow-y-auto"
      >
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8 md:hidden" />

        <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
          
          {/* Role Segmented Control */}
          <div className="flex bg-auth-surface p-1 rounded-full mb-6 md:mb-8 relative">
            {(['user', 'admin'] as const).map((r) => {
              const isActive = role === r;
              return (
                  <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRole(r);
                    if (r === 'user') setAuthMode('signin');
                  }}
                  className={`relative flex-1 min-h-[44px] py-2.5 md:py-3 rounded-full text-sm md:text-base font-bold transition-all duration-300 flex items-center justify-center gap-2 z-10 cursor-pointer ${
                    isActive ? 'text-[var(--color-auth-bg)]' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r === 'user' ? <User className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  <span className="capitalize">{r}</span>
                  {isActive && (
                    <motion.div
                      layoutId="role-indicator"
                      className="absolute inset-0 bg-white rounded-full shadow-sm z-[-1]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {role === 'user' ? (
              <motion.div
                key="user-auth"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <div className="mb-6 md:mb-8">
                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-1.5 md:mb-2">
                    {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <p className="text-gray-500 font-medium text-sm md:text-base">
                    {authMode === 'signin' ? 'Enter your mobile number to continue.' : 'Sign up to start earning rewards.'}
                  </p>
                </div>

                <form onSubmit={handleUserAuth} className="flex flex-col gap-4 md:gap-5">
                  <div className="flex flex-col gap-1.5 md:gap-2">
                    <label className="text-xs md:text-sm font-bold text-gray-700 pl-4 uppercase tracking-wider">Mobile Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 flex items-center pointer-events-none border-r border-gray-200 pr-3 my-2.5 md:my-3">
                        <span className="text-sm md:text-base font-bold text-gray-800">+91</span>
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        required
                        className="w-full pl-16 md:pl-20 pr-5 md:pr-6 py-3.5 md:py-4 bg-auth-surface rounded-full text-base font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-auth-blue-light transition-all"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {authMode === 'signup' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-1.5 md:gap-2 overflow-hidden"
                      >
                        <label className="text-xs md:text-sm font-bold text-gray-700 pl-4 uppercase tracking-wider">Full Name</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 flex items-center pointer-events-none text-gray-400">
                            <User className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required={authMode === 'signup'}
                            className="w-full pl-12 md:pl-14 pr-5 md:pr-6 py-3.5 md:py-4 bg-auth-surface rounded-full text-base font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-auth-blue-light transition-all"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="mt-2 md:mt-4 w-full py-3.5 md:py-4 px-6 bg-auth-accent text-[var(--color-auth-bg)] hover:bg-[#CDF22B] rounded-full font-black text-[14px] md:text-[15px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(199,239,102,0.4)]"
                  >
                    {isSubmittingUser ? (
                      <div className="w-5 h-5 border-2 border-[var(--color-auth-bg)]/30 border-t-[var(--color-auth-bg)] rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                        <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 md:mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                    className="text-sm md:text-base font-bold text-gray-500 hover:text-[var(--color-auth-bg)] min-h-[44px] transition-colors cursor-pointer inline-flex items-center justify-center px-4"
                  >
                    {authMode === 'signin' ? "Don't have an account? Sign Up" : "Already a member? Sign In"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="admin-auth"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <div className="mb-6 md:mb-8">
                  <h2 className="text-2xl md:text-3xl font-black text-[var(--color-auth-bg)] tracking-tight mb-1.5 md:mb-2">
                    Admin Portal
                  </h2>
                  <p className="text-gray-500 font-medium text-[13px] md:text-sm">
                    Enter your secure PIN to access the dashboard.
                  </p>
                </div>

                <form onSubmit={handleAdminAuth} className="flex flex-col gap-4 md:gap-5">
                  <div className="flex flex-col gap-1.5 md:gap-2">
                    <label className="text-[11px] md:text-xs font-bold text-gray-700 pl-4 uppercase tracking-wider flex justify-between items-center pr-2">
                      <span>Security PIN</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 md:pl-5 flex items-center pointer-events-none text-gray-400">
                        <KeyRound className="w-4 h-4 md:w-5 h-5 text-[var(--color-auth-bg)]" />
                      </div>
                      <input
                        type="password"
                        maxLength={6}
                        placeholder="••••••"
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        required
                        className="w-full pl-12 md:pl-14 pr-5 md:pr-6 py-3.5 md:py-4 bg-auth-surface rounded-full text-base md:text-lg font-black text-[var(--color-auth-bg)] tracking-[0.5em] placeholder:text-gray-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-[var(--color-auth-bg)] transition-all text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAdmin}
                    className="mt-2 md:mt-4 w-full py-3.5 md:py-4 px-6 bg-auth-bg text-white hover:bg-auth-bg/90 rounded-full font-black text-[14px] md:text-[15px] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(17,53,139,0.3)]"
                  >
                    {isSubmittingAdmin ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 md:w-5 h-5" />
                        <span>Unlock Console</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
