import React, { useState } from 'react';
import { 
  User, 
  ShieldCheck, 
  Phone, 
  KeyRound, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Smartphone,
  Gift,
  Download,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

  // User Auth State
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [isNewUserRegistration, setIsNewUserRegistration] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Admin Auth State
  const [adminPin, setAdminPin] = useState('');
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // User Submit Handler
  const handleUserAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setUserError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (cleanPhone === '8650124154') {
      setUserError('This number is reserved for Admin. Please use the Admin tab.');
      return;
    }

    setIsSubmittingUser(true);

    try {
      if (isNewUserRegistration) {
        // Full Registration Flow
        const cleanName = fullName.trim();
        if (!cleanName || cleanName.length < 2) {
          setUserError('Please enter your full name to complete registration.');
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
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error('Invalid server response format');
        }

        if (!res.ok) {
          throw new Error(data.error || 'Registration failed.');
        }

        onUserLoginSuccess(data.user, data.token);
      } else {
        // Direct Phone Login Flow
        const res = await fetch(apiUrl('/api/client/login-phone'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone }),
        });

        const rawText = await res.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error('Invalid server response format');
        }

        if (!res.ok) {
          if (data.isNewUser || res.status === 404) {
            // Smoothly prompt for name
            setIsNewUserRegistration(true);
            setUserError('Number not registered yet. Please enter your name to complete instant signup.');
            setIsSubmittingUser(false);
            return;
          }
          throw new Error(data.error || 'Failed to sign in.');
        }

        onUserLoginSuccess(data.user, data.token);
      }
    } catch (err: unknown) {
      console.error('User auth error:', err);
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setUserError(msg);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Admin PIN Submit Handler
  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setIsSubmittingAdmin(true);

    const validPin = '865012';
    if (adminPin.trim() === validPin) {
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      sessionStorage.setItem('adminToken', 'ADMIN_SESSION_ACTIVE');
      onAdminLoginSuccess();
    } else {
      setAdminError('Invalid Security PIN. Please verify your administrator credentials.');
      setIsSubmittingAdmin(false);
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
    <div className="w-full max-w-md mx-auto px-4 py-4 sm:py-8 flex flex-col items-center">
      
      {/* Subtle, beautiful top APK Banner */}
      <div className="w-full mb-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-100/80 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="text-left">
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

      {/* Brand Icon & Heading */}
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 mb-3">
          <Gift className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          QR Incentive Portal
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Scan codes, claim reward points & manage benefits
        </p>
      </div>

      {/* Main Auth Container */}
      <div className="w-full bg-white border border-gray-100 rounded-3xl p-5 sm:p-7 shadow-sm">
        
        {/* Role Toggle Switch */}
        <div className="grid grid-cols-2 gap-1.5 bg-gray-100/90 p-1.5 rounded-2xl mb-6">
          <button
            id="auth-tab-user-btn"
            type="button"
            onClick={() => {
              setRole('user');
              setUserError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              role === 'user'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Sign in as User</span>
          </button>

          <button
            id="auth-tab-admin-btn"
            type="button"
            onClick={() => {
              setRole('admin');
              setAdminError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              role === 'admin'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Portal</span>
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {role === 'user' ? (
            <motion.form
              key="user-auth-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleUserAuth}
              className="flex flex-col gap-4"
            >
              {userError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{userError}</span>
                </div>
              )}

              {/* Mobile Phone Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                  <span>Mobile Phone Number</span>
                  <span className="text-[11px] font-normal text-gray-400">10 Digits</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <span className="text-xs font-bold text-gray-500 mr-1">+91</span>
                  </div>
                  <input
                    id="user-phone-input"
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ''));
                      setUserError(null);
                    }}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm font-medium outline-none transition-all"
                  />
                </div>
              </div>

              {/* Name Field (for new signups) */}
              <AnimatePresence>
                {isNewUserRegistration && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-1.5 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-700">Full Name</label>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        New Member Signup
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="user-fullname-input"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isNewUserRegistration}
                        className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm font-medium outline-none transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toggle to register / sign in */}
              <div className="flex items-center justify-between text-xs pt-1">
                {isNewUserRegistration ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewUserRegistration(false);
                      setUserError(null);
                    }}
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    Already have an account? Sign in
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewUserRegistration(true);
                      setUserError(null);
                    }}
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    New user? Register now
                  </button>
                )}
              </div>

              {/* Submit Button */}
              <button
                id="user-auth-submit-btn"
                type="submit"
                disabled={isSubmittingUser}
                className="mt-2 w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmittingUser ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>{isNewUserRegistration ? 'Register & Continue' : 'Sign In as User'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="admin-auth-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleAdminAuth}
              className="flex flex-col gap-4"
            >
              {adminError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                  <span>Security PIN</span>
                  <span className="text-[11px] font-normal text-gray-400">Authorized Admins</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="admin-pin-input"
                    type="password"
                    maxLength={6}
                    placeholder="••••••"
                    value={adminPin}
                    onChange={(e) => {
                      setAdminPin(e.target.value);
                      setAdminError(null);
                    }}
                    required
                    className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm font-medium outline-none transition-all tracking-widest"
                  />
                </div>
              </div>

              <button
                id="admin-auth-submit-btn"
                type="submit"
                disabled={isSubmittingAdmin}
                className="mt-2 w-full py-3.5 px-4 bg-slate-900 hover:bg-black active:scale-98 text-white rounded-xl font-bold text-sm shadow-md shadow-slate-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmittingAdmin ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
      </div>

    </div>
  );
}
