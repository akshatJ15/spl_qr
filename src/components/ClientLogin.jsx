import React, { useState } from 'react';
import { Smartphone, User, ShieldAlert, LogIn, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiUrl } from '../utils/api';

export default function ClientLogin({ onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    if (!trimmedPhone) {
      setError('Please provide a mobile phone number to authenticate.');
      return;
    }

    if (!trimmedName) {
      setError('Please enter your full name for credentials generation.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/client/auth'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: trimmedPhone, name: trimmedName }),
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Authentication process failed.');
      }

      // Success! Persist the token to client storage
      localStorage.setItem('clientToken', data.token);
      localStorage.setItem('clientUser', JSON.stringify(data.user));

      // Advise parent that the session was established
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess();
      }
    } catch (err) {
      console.error('Login action error:', err);
      setError(err.message || 'Check connection settings and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden p-6 md:p-8 flex flex-col justify-between relative">
      
      {/* Dynamic Header Badge */}
      <div className="flex flex-col items-center mb-6">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl mb-3 border border-blue-100/40">
          <Smartphone className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 tracking-tight text-center">Mobile Authentication</h3>
        <p className="text-xs text-gray-400 mt-1 text-center leading-relaxed">
          Unlock your reward points instantly. No passwords required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mobile Input */}
        <div>
          <label htmlFor="phone-input" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Mobile Number
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <input
              id="phone-input"
              type="tel"
              required
              disabled={loading}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50/80 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium text-gray-800 text-sm"
              placeholder="+91 XXXXX XXXXX"
            />
          </div>
        </div>

        {/* Full Name Input */}
        <div>
          <label htmlFor="name-input" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <User className="w-4 h-4" />
            </div>
            <input
              id="name-input"
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50/80 border border-gray-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium text-gray-800 text-sm"
              placeholder="e.g. Rahul Sharma"
            />
          </div>
        </div>

        {/* Error Alert Box */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 text-xs font-medium leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <button
          id="login-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Logging in secure session...
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Login / Register
            </>
          )}
        </button>
      </form>

      {/* Safety Notice Panel */}
      <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-center gap-2 text-[10px] text-gray-400">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Locked Admin Rule Active (8650124154 Locked)</span>
      </div>

    </div>
  );
}
