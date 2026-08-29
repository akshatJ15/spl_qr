import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import ClientClaim from './components/ClientClaim';
import UserDashboard from './components/UserDashboard';
import UnifiedAuthScreen from './components/UnifiedAuthScreen';
import { Gift, ShieldCheck, Database, HelpCircle, LogOut, User, Smartphone, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfile {
  _id: string;
  name: string;
  phone: string;
  points: number;
}

export default function App() {
  const [route, setRoute] = useState<'app' | 'claim'>('app');
  const [currentToken, setCurrentToken] = useState('');

  // Admin Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return sessionStorage.getItem('isAdminAuthenticated') === 'true';
  });

  // Client User Auth State
  const [clientUser, setClientUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('clientUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Handle URL changes & token query parameters
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const pathname = window.location.pathname;
      const token = params.get('token');

      if (token || pathname.includes('/claim')) {
        setRoute('claim');
        if (token) {
          setCurrentToken(token);
        }
      } else {
        setRoute('app');
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Admin Login Handler
  const handleAdminLoginSuccess = () => {
    sessionStorage.setItem('isAdminAuthenticated', 'true');
    sessionStorage.setItem('adminToken', 'ADMIN_SESSION_ACTIVE');
    setIsAdminAuthenticated(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('isAdminAuthenticated');
    sessionStorage.removeItem('adminToken');
    setIsAdminAuthenticated(false);
  };

  // Client User Login Handler
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
    <div className="min-h-screen bg-slate-50 text-gray-900 flex flex-col antialiased font-sans transition-colors duration-200">
      
      {/* Universal Responsive Header */}
      <header className="print:hidden w-full bg-white border-b border-gray-100 py-3.5 px-4 sm:px-6 sticky top-0 z-50 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => {
              if (route === 'claim') {
                window.history.pushState({}, '', '/');
                setRoute('app');
                setCurrentToken('');
              }
            }}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <div className="p-1.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-gray-900 block leading-tight">
                QR Incentive Core
              </span>
              <span className="text-[10px] text-gray-400 font-mono hidden sm:block leading-none mt-0.5">
                Multi-Role Rewards Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium">
            {/* Status Pills for Desktop */}
            <span className="hidden md:flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-100 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              ONLINE
            </span>

            {/* If on web claim page, allow navigating to App Home */}
            {route === 'claim' && (
              <button
                id="header-nav-app-btn"
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  setRoute('app');
                  setCurrentToken('');
                }}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Go to Portal Home
              </button>
            )}

            {/* Admin Sign Out */}
            {route === 'app' && isAdminAuthenticated && (
              <button
                id="header-admin-logout-btn"
                onClick={handleAdminLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 rounded-xl font-semibold transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span> Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {route === 'claim' ? (
            /* External Physical QR Scan Flow */
            <motion.div
              key="claim-view"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <ClientClaim />
            </motion.div>
          ) : isAdminAuthenticated ? (
            /* Admin Console Dashboard */
            <motion.div
              key="admin-view"
              className="print:p-0 print:border-none print:shadow-none w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <div className="print:hidden text-center max-w-lg mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Console Active
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                  Incentive QR Management
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
                  Generate batches of secure, single-use reward QR tokens and monitor real-time claims.
                </p>
              </div>

              <div className="w-full print:p-0">
                <AdminDashboard />
              </div>
            </motion.div>
          ) : clientUser ? (
            /* Logged-In Client User Mobile Experience */
            <motion.div
              key="user-view"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <UserDashboard
                user={clientUser}
                onLogout={handleUserLogout}
                onUpdateUser={handleUpdateUser}
              />
            </motion.div>
          ) : (
            /* Universal Landing & Auth Screen (User Default + Admin Tab) */
            <motion.div
              key="auth-view"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
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

      {/* Footer */}
      <footer className="print:hidden w-full bg-white border-t border-gray-100 py-4 px-4 text-center text-xs text-gray-400 font-mono">
        <p>© 2026 QR Incentive Engine. Responsive Mobile & Web Ready.</p>
      </footer>
    </div>
  );
}
