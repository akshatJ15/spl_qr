import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, Printer, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiUrl } from '../utils/api';

export default function AdminGenerator() {
  const [points, setPoints] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedData, setGeneratedData] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (points <= 0 || isNaN(points)) {
      setError('Please enter a valid number of points greater than 0.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedData(null);

    try {
      const response = await fetch(apiUrl('/api/admin/generate-qr'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ points: Number(points) }),
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate QR Token.');
      }

      setGeneratedData(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white border border-gray-100 rounded-2xl shadow-sm p-6 md:p-8">
      {/* Dynamic Printing Style Block */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide everything on the page including parents */
          body * {
            visibility: hidden !important;
            background: none !important;
          }
          /* Ensure the target container and its content is visual */
          #printable-qr-area, #printable-qr-area * {
            visibility: visible !important;
          }
          /* Absolute center the QR on the printed sheet */
          #printable-qr-area {
            position: absolute !important;
            left: 0 !important;
            top: 2in !important;
            width: 100% !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
          }
          /* Hide shadow/border structures of paper inside print preview */
          #printable-qr-area .no-print-border {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}} />

      {/* Admin Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">QR Incentive Generator</h2>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Admin Control Panel</p>
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleGenerate} className="space-y-5">
        <div>
          <label htmlFor="points-input" className="block text-sm font-medium text-gray-700 mb-1.5">
            Points to Award
          </label>
          <div className="relative">
            <input
              id="points-input"
              type="number"
              min="1"
              value={points}
              onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value) || 0))}
              disabled={loading}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium text-gray-900"
              placeholder="e.g. 10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
              pts
            </span>
          </div>
        </div>

        <button
          id="generate-btn"
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white font-medium rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating unique token...
            </>
          ) : (
            'Generate Unique QR'
          )}
        </button>
      </form>

      {/* Messages */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 text-sm"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated Output */}
      <AnimatePresence>
        {generatedData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 p-5 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center text-center"
          >
            <div className="w-full flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-lg text-xs font-medium justify-center mb-4">
              <CheckCircle className="w-3.5 h-3.5" />
              Successfully Generated unique QR Incentive
            </div>

            {/* Printable Container */}
            <div id="printable-qr-area" className="flex flex-col items-center">
              <div className="no-print-border p-4 bg-white border border-gray-100 rounded-xl shadow-xs flex flex-col items-center">
                <QRCodeSVG
                  value={`${window.location.origin}/claim?token=${generatedData.token}`}
                  size={180}
                  level="H"
                  includeMargin={true}
                  className="mx-auto"
                />
                
                <div className="mt-3 text-center">
                  <span className="inline-block px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-100 rounded-full text-xs font-bold font-mono">
                    {generatedData.points} POINTS
                  </span>
                  <p className="text-[10px] text-gray-400 font-mono mt-1.5 max-w-[200px] truncate">
                    UUID: {generatedData.token}
                  </p>
                  <p className="hidden print:block text-xs text-gray-500 font-medium mt-1">
                    Scan to Claim Points
                  </p>
                </div>
              </div>
            </div>

            {/* Live Actions */}
            <div className="mt-5 w-full space-y-2.5">
              <div className="text-left bg-gray-100/50 p-3 rounded-lg border border-gray-200/50 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-green-600 font-bold font-mono">Live Scan Target Link (Active)</p>
                  <a 
                    href={`${window.location.origin}/claim?token=${generatedData.token}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline select-all break-all block mt-0.5 font-mono font-semibold"
                  >
                    {`${window.location.origin}/claim?token=${generatedData.token}`}
                  </a>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Localhost Reference (Core Config)</p>
                  <code className="text-[11px] text-gray-500 select-all break-all block mt-0.5 font-mono">
                    {generatedData.url}
                  </code>
                </div>
              </div>

              {/* Safe Iframe Simulation Trigger */}
              <button
                id="simulate-scan-btn"
                onClick={() => {
                  window.history.pushState({}, '', `/claim?token=${generatedData.token}`);
                  window.dispatchEvent(new Event('popstate'));
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm font-semibold shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                Simulate Scan (Safe In-App)
              </button>

              <a
                href={`${window.location.origin}/claim?token=${generatedData.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-sky-200"
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                Open Live Link in New Tab
              </a>

              <button
                id="print-btn"
                onClick={handlePrint}
                className="w-full py-2.5 bg-gray-950 hover:bg-gray-900 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Printer className="w-4 h-4" />
                Print QR Code
              </button>
              
              <p className="text-[10px] text-gray-400 max-w-sm mx-auto mt-2 leading-relaxed">
                Note: Localhost (<code className="font-mono">localhost:3000</code>) links only work when running this repository on your local computer. In this hosted sandbox, click <strong>Simulate Scan</strong> or <strong>Open Live Link</strong> to verify the QR validation module safely!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
