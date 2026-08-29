import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import ClientClaim from './components/ClientClaim';
import UserDashboard from './components/UserDashboard';
import UnifiedAuthScreen from './components/UnifiedAuthScreen';
import { Gift, ShieldCheck, LogOut, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'react-hot-toast';

interface UserProfile {
  _id: string;
  name: string;
  phone: string;
  points: number;
}

export default function App() {
  const [route, setRoute] = useState<'app' | 'claim'>('app');
  const [currentToken, setCurrentToken] = useState('');

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('isAdminAuthenticated') === 'true';
  });

  const [clientUser, setClientUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('clientUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      const token = params.get('token');
      if (token || pathname.includes('/claim')) {
        setRoute('claim');
        if (token) setCurrentToken(token);
      } else {
        setRoute('app');
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleAdminLoginSuccess = () => {
    sessionStorage.setItem('isAdminAuthenticated', 'true');
    setIsAdminAuthenticated(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('isAdminAuthenticated');
    sessionStorage.removeItem('adminToken');
    setIsAdminAuthenticated(false);
  };

  const handleUserLoginSuccess = (user: UserProfile, token: string) => {
    localStorage.setItem('clientToken', token);
    localStorage.setItem('clientUser', JSON.stringify(user));
    setClientUser(user);
  };

  const handleUserLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientUser');
    setClientUser(null);
  };

  const handleUpdateUser = (updatedUser: UserProfile) => {
    setClientUser(updatedUser);
  };

  return (
    <div className="min-h-dvh flex flex-col antialiased font-sans text-gray-900">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(108,61,209,0.25)',
          },
          success: {
            style: {
              background: 'rgba(108,61,209,0.25)',
              color: 'rgba(108,61,209,0.25)',
              border: '1px solid rgba(108,61,209,0.25)',
            },
          },
          error: {
            style: {
              background: 'rgba(108,61,209,0.25)',
              color: 'rgba(108,61,209,0.25)',
              border: '1px solid rgba(108,61,209,0.25)',
            },
          },
        }}
      />
      
      {/* ===== HEADER ===== */}
      <header className="print:hidden header-bar w-full py-3.5 px-4 sm:px-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => {
              if (route === 'claim') {
                window.history.pushState({}, '', '/');
                setRoute('app');
                setCurrentToken('');
              }
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-700 text-white rounded-xl shadow-sm transition-transform group-hover:scale-105" style={{ boxShadow: '0 4px 12px rgba(108,61,209,0.25)' }}>
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-gray-900 block leading-tight gradient-text">
                QR Rewards
              </span>
              <span className="text-[10px] text-gray-400 font-medium hidden sm:block leading-none mt-0.5">
                Incentive Rewards Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-medium">
            {/* Online badge */}
            <span className="hidden md:flex items-center gap-1.5 pill-success px-2.5 py-1 rounded-full text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Online
            </span>

            {route === 'claim' && (
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  setRoute('app');
                  setCurrentToken('');
                }}
                className="pill-brand px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer hover:bg-violet-100 transition-colors"
              >
                Portal Home
              </button>
            )}

            {route === 'app' && isAdminAuthenticated && (
              <button
                onClick={handleAdminLogout}
                className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl font-semibold text-gray-600 hover:text-rose-600 hover:border-rose-200 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span> Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-10 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {route === 'claim' ? (
            <motion.div
              key="claim-view"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <ClientClaim />
            </motion.div>
          ) : isAdminAuthenticated ? (
            <motion.div
              key="admin-view"
              className="print:p-0 print:border-none print:shadow-none w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="print:hidden text-center max-w-lg mb-8 sm:mb-10">
                <div className="inline-flex items-center gap-1.5 pill-brand px-3.5 py-1.5 rounded-full text-xs font-bold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Console Active
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="gradient-text">QR Management</span>
                </h1>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed font-medium">
                  Generate batches of secure, single-use reward QR tokens and monitor real-time claims.
                </p>
              </div>
              <div className="w-full print:p-0">
                <AdminDashboard />
              </div>
            </motion.div>
          ) : clientUser ? (
            <motion.div
              key="user-view"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <UserDashboard
                user={clientUser}
                onLogout={handleUserLogout}
                onUpdateUser={handleUpdateUser}
              />
            </motion.div>
          ) : (
            <motion.div
              key="auth-view"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <UnifiedAuthScreen
                onUserLoginSuccess={handleUserLoginSuccess}
                onAdminLoginSuccess={handleAdminLoginSuccess}
                initialRole="user"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="print:hidden w-full py-5 px-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 font-medium">
          <Sparkles className="w-3 h-3" />
          <span>© 2026 QR Rewards · Built for scale</span>
        </div>
      </footer>
    </div>
  );
}
