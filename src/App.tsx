import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/AdminDashboard';
import ClientClaim from './components/ClientClaim';
import UserDashboard from './components/UserDashboard';
import UnifiedAuthScreen from './components/UnifiedAuthScreen';
import { Gift, ShieldCheck, LogOut, Sparkles, WifiOff, Smartphone, CheckCircle2, AlertCircle, QrCode } from 'lucide-react';
import { Network } from '@capacitor/network';
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
  const [isOnline, setIsOnline] = useState(true);

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
    
    // Check initial network status
    const initNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } catch (e) {
        // Ignored, probably not running in Capacitor or supported browser
      }
    };
    initNetwork();

    // Listen for network changes
    const networkListener = Network.addListener('networkStatusChange', status => {
      setIsOnline(status.connected);
    });

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      networkListener.then(listener => listener.remove());
    };
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

  const isAuthView = !isAdminAuthenticated && !clientUser && route !== 'claim';

  return (
    <div 
      className="min-h-dvh flex flex-col antialiased font-sans text-gray-900"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '16px',
            padding: '12px 20px',
            background: '#ffffff',
            color: '#1e293b',
            boxShadow: '0 10px 30px -5px rgba(17,53,139,0.15)',
            border: '1px solid #EFF0F4',
          },
          success: {
            style: {
              background: '#10B981',
              color: '#ffffff',
              border: 'none',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#10B981',
            },
          },
          error: {
            style: {
              background: '#EF4444',
              color: '#ffffff',
              border: 'none',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#EF4444',
            },
          },
        }}
      />
      
      {/* ===== OFFLINE BANNER ===== */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="w-full bg-red-500 text-white text-xs sm:text-sm font-bold py-2 px-4 flex items-center justify-center gap-2 z-[60] shadow-md relative"
          >
            <WifiOff className="w-4 h-4" />
            <span>No Internet Connection. The app requires an active connection.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== HEADER ===== */}
      <header className="print:hidden w-full py-3.5 px-4 sm:px-6 sticky top-0 z-50 bg-[#C7EF66] shadow-sm">
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
            <div className="p-2 bg-auth-bg text-white rounded-[12px] shadow-[0_4px_16px_rgba(17,53,139,0.2)] transition-transform group-hover:scale-105">
              <span className="font-black text-xl font-sans leading-none flex items-center justify-center w-5 h-5">Q</span>
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-auth-bg block leading-tight">
                Ouick Scan
              </span>
              <span className="text-[10px] text-auth-bg/70 font-medium hidden sm:block leading-none mt-0.5">
                Quick QR Scanner
              </span>
            </div>
          </div>

          {route === 'app' && isAdminAuthenticated && (
            <div id="admin-navbar-portal" className="hidden lg:flex flex-1 items-center justify-center mx-4"></div>
          )}

          <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-medium">
            {route === 'claim' && (
               <button
                 onClick={() => {
                   window.history.pushState({}, '', '/');
                   setRoute('app');
                   setCurrentToken('');
                 }}
                 className="px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer bg-white text-brand-blue hover:bg-white/80 transition-colors"
               >
                 Portal Home
               </button>
            )}

            {route === 'app' && isAdminAuthenticated && (
              <button
                onClick={handleAdminLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-rose-600 rounded-xl font-bold hover:bg-rose-50 transition-all shadow-sm cursor-pointer"
                title="Admin Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span> Sign Out
              </button>
            )}

            {route === 'app' && clientUser && (
              <div className="flex items-center gap-2.5 sm:gap-4">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white text-brand-blue flex items-center justify-center text-[11px] font-bold shadow-sm">
                    {clientUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-auth-bg">{clientUser.name.split(' ')[0]}</span>
                </div>
                <button
                  onClick={handleUserLogout}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-rose-600 rounded-xl font-bold hover:bg-rose-50 transition-all shadow-sm cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 w-full h-full flex flex-col relative m-0 p-0 overflow-hidden bg-[#EFF0F4]">
        <AnimatePresence mode="wait">
          {route === 'claim' ? (
            <motion.div
              key="claim-view"
              className="w-full flex flex-col items-center max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-10 h-full overflow-y-auto"
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
              className="print:p-0 print:border-none print:shadow-none w-full flex flex-col items-center max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-10 h-full overflow-y-auto"
              initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="w-full print:p-0">
                <AdminDashboard />
              </div>
            </motion.div>
          ) : clientUser ? (
            <motion.div
              key="user-view"
              className="w-full flex flex-col items-center max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-10 h-full overflow-y-auto"
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
              className="w-full h-full flex flex-col flex-1 items-center justify-center max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10"
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


    </div>
  );
}
