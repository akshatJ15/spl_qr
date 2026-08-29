import React, { useState } from 'react';
import { Lock, Smartphone, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [loginNo, setLoginNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const formattedNo = loginNo.trim();
    const formattedPass = password.trim();

    if (!formattedNo || !formattedPass) {
      setError('Please fill in all security fields.');
      return;
    }

    // Direct static checks as explicitly requested
    if (formattedNo === '7217251263' && formattedPass === '1234') {
      setIsSuccess(true);
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      sessionStorage.setItem('adminToken', 'MOCK_ADMIN_TOKEN');
      setTimeout(() => {
        onLoginSuccess();
      }, 800);
    } else {
      setError('Invalid system credentials. Please check your login number and password.');
    }
  };

  return (
    <div id="admin-login-wrapper" className="w-full max-w-md mx-auto print:hidden">
      <motion.div
        id="admin-login-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-white border border-gray-100 rounded-3xl shadow-xl p-8 flex flex-col"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className={`p-4 rounded-2xl mb-4 transition-colors duration-300 ${isSuccess ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
            <Lock className="w-8 h-8" />
          </div>
          <h2 id="admin-login-title" className="text-2xl font-bold text-gray-900 tracking-tight">
            Admin Authentication
          </h2>
          <p id="admin-login-subtitle" className="mt-2 text-sm text-gray-500 leading-relaxed">
            Enter authorized local system credentials to gain management portal entry.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <motion.div
              id="admin-login-error"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-start gap-2.5 font-medium"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {isSuccess && (
            <motion.div
              id="admin-login-success"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-3.5 bg-green-50 border border-green-100 text-green-700 rounded-xl text-xs flex items-center gap-2.5 font-medium"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Authentication approved! Redirecting...</span>
            </motion.div>
          )}

          <div>
            <label htmlFor="loginNo" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Login Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Smartphone className="w-4 h-4" />
              </span>
              <input
                id="loginNo"
                name="loginNo"
                type="text"
                placeholder="e.g. 7217251263"
                value={loginNo}
                onChange={(e) => setLoginNo(e.target.value)}
                disabled={isSuccess}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSuccess}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />
            </div>
          </div>

          <button
            id="admin-login-submit"
            type="submit"
            disabled={isSuccess}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-center"
          >
            {isSuccess ? 'Authorizing Interface...' : 'Verify Identity'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
