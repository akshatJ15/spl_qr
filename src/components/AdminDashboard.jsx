import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiUrl, getApiBaseUrl, fetchWithTimeout } from '../utils/api';
import { 
  Sparkles, 
  Printer, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Users, 
  UserMinus, 
  Search, 
  Smartphone, 
  Coins, 
  CreditCard,
  Building,
  DollarSign,
  ArrowLeft,
  Calendar,
  PieChart as PieChartIcon,
  Download,
  Box,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

export default function AdminDashboard() {
  // Required specs state variables
  const [pointsToAward, setPointsToAward] = useState(10);
  const [quantity, setQuantity] = useState(1);
  const [generatedQrs, setGeneratedQrs] = useState([]); // Replaces the single generatedQrUrl string
  const [generatedPoints, setGeneratedPoints] = useState(10); // Standardized across generated batch
  const [qrBaseUrl, setQrBaseUrl] = useState(getApiBaseUrl() || window.location.origin); // Custom base URL for scanners
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Custom interface and UX helper states
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [minPointsFilter, setMinPointsFilter] = useState('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null);

  // New View states for User Detail History
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'generator', 'ledger', 'lots', 'export'
  const [activeView, setActiveView] = useState('ledger'); // 'ledger' or 'userDetail' for ledger tab
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // New states for Analytics, Lots, Export
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  const [qrLotsData, setQrLotsData] = useState([]);
  const [qrLotsLoading, setQrLotsLoading] = useState(false);
  const [expandedLot, setExpandedLot] = useState(null);

  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Custom confirmation modal state for zeroing out points
  const [resetConfirmation, setResetConfirmation] = useState(null);

  // Diagnostic Logs state and panel visibility state
  const [diagnosticLogs, setDiagnosticLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true);

  // Core logging action helper
  const addLog = (category, text) => {
    const timeStr = new Date().toLocaleTimeString();
    const entry = `[${timeStr}] [${category.toUpperCase()}] ${text}`;
    console.log(entry);
    setDiagnosticLogs(prev => [entry, ...prev]);
  };

  const getAdminAuthToken = () => {
    return sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken') || 'MOCK_ADMIN_TOKEN';
  };

  // 1. Fetch beneficiary ledgers on mount
  const fetchLedger = async () => {
    setLedgerLoading(true);
    addLog('system', 'Refreshing beneficiary ledger from database...');
    try {
      const response = await fetchWithTimeout(apiUrl('/api/admin/beneficiaries'), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminAuthToken()}`
        }
      });
      addLog('network', `GET /api/admin/beneficiaries response status: ${response.status} ${response.statusText}`);
      
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync beneficiaries database.');
      }
      
      const userArr = Array.isArray(data) ? data : [];
      setBeneficiaries(userArr);
      addLog('success', `Ledger synchronized successfully. Loaded ${userArr.length} database beneficiary records.`);
    } catch (err) {
      console.error('Ledger Retrieval Error:', err);
      addLog('error', `Ledger sync failure: ${err.message}`);
      setError(err.message || 'System connection offline. Using sandbox fallback.');
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchUserHistory = async (phone) => {
    setHistoryLoading(true);
    addLog('system', `Fetching scan history for user ${phone}...`);
    try {
      const response = await fetchWithTimeout(apiUrl(`/api/admin/user/${phone}/history`), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminAuthToken()}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch user history.');
      setSelectedUser(data.user);
      setUserHistory(data.history || []);
      setActiveView('userDetail');
      addLog('success', `User history loaded with ${data.history?.length} records.`);
    } catch (err) {
      console.error('History Fetch Error:', err);
      addLog('error', `History sync failure: ${err.message}`);
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    addLog('system', 'Fetching global analytics data...');
    try {
      const response = await fetchWithTimeout(apiUrl('/api/admin/analytics'), {
        headers: {
          'Authorization': `Bearer ${getAdminAuthToken()}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch analytics.');
      setAnalyticsData(data.metrics);
      addLog('success', 'Analytics data loaded.');
    } catch (err) {
      console.error('Analytics Fetch Error:', err);
      addLog('error', `Analytics fetch failure: ${err.message}`);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchQrLots = async () => {
    setQrLotsLoading(true);
    addLog('system', 'Fetching QR Lots data...');
    try {
      const response = await fetchWithTimeout(apiUrl('/api/admin/qr-lots'), {
        headers: {
          'Authorization': `Bearer ${getAdminAuthToken()}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch QR Lots.');
      setQrLotsData(data.lots || []);
      addLog('success', `QR Lots data loaded with ${data.lots?.length} lots.`);
    } catch (err) {
      console.error('Lots Fetch Error:', err);
      addLog('error', `Lots fetch failure: ${err.message}`);
    } finally {
      setQrLotsLoading(false);
    }
  };

  const handleExport = async (e) => {
    e.preventDefault();
    setExportLoading(true);
    addLog('system', 'Initiating CSV export sequence...');
    try {
      const queryParams = new URLSearchParams();
      if (exportStartDate) queryParams.append('startDate', exportStartDate);
      if (exportEndDate) queryParams.append('endDate', exportEndDate);
      
      const response = await fetchWithTimeout(apiUrl(`/api/admin/export?${queryParams.toString()}`), {
        headers: {
          'Authorization': `Bearer ${getAdminAuthToken()}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate export.');
      
      const rows = data.data || [];
      if (rows.length === 0) {
        throw new Error('No data found for this date range.');
      }
      
      const headers = Object.keys(rows[0]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `qrs_export_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addLog('success', `CSV Export generated successfully with ${rows.length} rows.`);
      setActionSuccessMessage('CSV downloaded successfully.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Export Error:', err);
      addLog('error', `Export failure: ${err.message}`);
      setError(err.message);
    } finally {
      setExportLoading(false);
    }
  };

  // Sync Data (Global Refresh)
  const syncGlobalData = () => {
    fetchLedger();
    fetchAnalytics();
    fetchQrLots();
  };

  useEffect(() => {
    addLog('system', 'Initializing QR core admin dashboard application...');
    syncGlobalData();

    // Fetch server dynamic universal URL config
    const fetchConfigFromBackend = async () => {
      try {
        addLog('system', 'Fetching server configuration to determine authentic universal domain...');
        const response = await fetch(apiUrl('/api/public/config'));
        if (response.ok) {
          const data = await response.json();
          if (data && data.appUrl) {
            let processedUrl = data.appUrl.trim();
            // Chop trailing slash if exists to avoid double slash formatting errors
            if (processedUrl.endsWith('/')) {
              processedUrl = processedUrl.slice(0, -1);
            }
            // Add https protocol if missing
            if (!/^https?:\/\//i.test(processedUrl)) {
              processedUrl = 'https://' + processedUrl;
            }
            console.log(`[FRONTEND DYNAMIC DOMAIN] Detected global universal URL: "${processedUrl}"`);
            addLog('success', `Dynamic Domain auto-resolved universally to: ${processedUrl}`);
            setQrBaseUrl(processedUrl);
          } else {
            addLog('system', `No server-declared APP_URL found. Utilizing present origin: ${window.location.origin}`);
          }
        }
      } catch (err) {
        console.error('[FRONTEND CONF RETRIEVAL ERROR]', err);
        addLog('warning', `Could not fetch server domain config: ${err.message}. Defaulting to browser location.`);
      }
    };
    fetchConfigFromBackend();
  }, []);

  // 2. Generate Bulk QR Tokens
  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    console.log('[FRONTEND ADMIN] handleBulkGenerate initiating...');
    addLog('action', `Initiating Bulk QR Token generation for target points: ${pointsToAward}, quantity: ${quantity}`);
    
    if (pointsToAward === undefined || pointsToAward === null || isNaN(pointsToAward) || pointsToAward <= 0) {
      console.error('[FRONTEND ADMIN] Points validation rejected:', pointsToAward);
      addLog('warning', 'Validation rejected: points must be greater than 0.');
      setError('A valid number of points greater than 0 must be provided.');
      return;
    }

    if (quantity === undefined || quantity === null || isNaN(quantity) || quantity < 1 || quantity > 50) {
      console.error('[FRONTEND ADMIN] Quantity validation rejected:', quantity);
      addLog('warning', 'Validation rejected: quantity must be between 1 and 50.');
      setError('Quantity must be between 1 and 50.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedQrs([]);

    try {
      console.log(`[FRONTEND ADMIN] Triggering POST /api/admin/bulk-generate-qr with points=${pointsToAward}, qty=${quantity}`);
      addLog('network', `POST /api/admin/bulk-generate-qr - payload: { points: ${pointsToAward}, quantity: ${quantity} }`);
      
      const response = await fetch(apiUrl('/api/admin/bulk-generate-qr'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminAuthToken()}`
        },
        body: JSON.stringify({
          points: Number(pointsToAward),
          quantity: Number(quantity)
        }),
      });

      console.log(`[FRONTEND ADMIN] Fetch response status:`, response.status);
      addLog('network', `POST /api/admin/bulk-generate-qr response status: ${response.status} ${response.statusText}`);
      
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        console.error(`[FRONTEND ADMIN] API returned error status:`, data);
        throw new Error(data.error || 'Failure during bulk token registration.');
      }

      // Check format of response
      const rawTokens = Array.isArray(data) ? data : (data.tokens || []);
      const tokens = rawTokens.map(t => typeof t === 'string' ? { uid: t, lotNumber: 0 } : t);
      console.log(`[FRONTEND ADMIN] Tokens successfully received:`, tokens);
      
      setGeneratedQrs(tokens);
      setGeneratedPoints(Number(pointsToAward));
      
      addLog('success', `Created ${tokens.length} unique claim tokens successfully.`);
      setActionSuccessMessage(`Successfully registered ${tokens.length} dynamic ${pointsToAward} points tokens.`);
      
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err) {
      console.error('[FRONTEND ADMIN] Bulk QR Generator Error:', err);
      addLog('error', `Bulk generation aborted: ${err.message}`);
      setError(err.message || 'Connecting to QR bulk-provisioning node failed.');
    } finally {
      setLoading(false);
    }
  };

  // 3a. Initiate Reset Points Dialog
  const initiateResetPoints = (phone, name) => {
    addLog('action', `Click detected. Opening on-screen dynamic confirmation dialog for customer "${name}" (${phone})`);
    setResetConfirmation({ phone, name });
  };

  // 3b. Cancel Reset action
  const cancelResetPoints = () => {
    if (resetConfirmation) {
      addLog('action', `Payout canceled by Administrator: points reset for "${resetConfirmation.name}" aborted.`);
    }
    setResetConfirmation(null);
  };

  // 3c. Confirm points reset execution
  const executeResetPoints = async () => {
    if (!resetConfirmation) return;
    const { phone, name } = resetConfirmation;
    
    addLog('action', `Confirmed payout zero-out inside UI dialog. Sending execution command to backend database proxy for "${name}" (${phone})`);
    setResetConfirmation(null);
    setError(null);
    
    try {
      const payload = { phone };
      addLog('network', `POST /api/admin/reset-points - payload: ${JSON.stringify(payload)}`);
      
      const response = await fetchWithTimeout(apiUrl('/api/admin/reset-points'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminAuthToken()}`
        },
        body: JSON.stringify(payload),
      });

      addLog('network', `POST /api/admin/reset-points response status: ${response.status} ${response.statusText}`);
      
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to zero out user points.');
      }

      addLog('success', `Backend response confirmed: ${data.message || 'Points zeroed.'}`);
      if (data.verified) {
        addLog('success', `DB Transaction Verified! ${data.user?.name}'s balance has been updated to: ${data.user?.points} pts in the database.`);
      }

      setActionSuccessMessage(`Payout registered successfully. ${name}'s balance reset to zero.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
      
      addLog('system', 'Forcing automatic ledger update to synchronize live tables...');
      await fetchLedger();
    } catch (err) {
      console.error('Points Reset Exception:', err);
      addLog('error', `CRITICAL FAULT: Payout / Reset database operation failed. Cause: ${err.message}`);
      setError(err.message || 'Critical database update failed.');
    }
  };

  const handlePrint = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        const html2canvas = (await import('html2canvas')).default;
        
        const printArea = document.querySelector('.print-area') || document.body;
        addLog('action', 'Generating QR grid image for sharing...');
        
        const canvas = await html2canvas(printArea, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        
        const dataUrl = canvas.toDataURL('image/png');
        
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const fileName = `QR-Batch-${new Date().getTime()}.png`;
        
        // Write the base64 string (without the prefix) to the cache directory
        const base64Data = dataUrl.split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });
        
        await Share.share({
          title: 'QR Code Batch',
          text: 'Here are the generated QR codes for printing.',
          url: savedFile.uri,
          dialogTitle: 'Share QR Codes'
        });
        
        addLog('success', 'Image generated and shared successfully.');
        return;
      }
    } catch (e) {
      console.warn('Native sharing failed, falling back to window.print()', e);
    }
    
    window.print();
  };

  // Filter local state based on text queries and column filters
  const filteredBeneficiaries = beneficiaries.filter(b => {
    const matchesGlobal = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.phone.includes(searchQuery);
    const matchesName = b.name.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesPhone = b.phone.includes(phoneFilter);
    const matchesPoints = minPointsFilter === '' || b.points >= Number(minPointsFilter);
    return matchesGlobal && matchesName && matchesPhone && matchesPoints;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      
      {/* Dynamic Print CSS Injection Block */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Completely hide all elements by default */
          body * {
            visibility: hidden !important;
            background: none !important;
          }
          /* Make only the printable grid frame and its children visible */
          #printable-grid-frame, #printable-grid-frame * {
            visibility: visible !important;
          }
          /* Grid dimensions for 2x2 inch cards */
          #printable-grid-frame {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(auto-fill, 2in) !important;
            gap: 15px !important;
            padding: 10px !important;
            margin: 0 !important;
          }
          .qr-print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px dashed #999999 !important;
            width: 2in !important;
            height: 2in !important;
            padding: 8px !important;
            border-radius: 8px !important;
            background-color: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
        }
      `}} />

      {/* Global Alert Notification Banner */}
      <AnimatePresence mode="wait">
        {(error || actionSuccessMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="print:hidden w-full"
          >
            {error ? (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-800 text-sm font-medium">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-red-900">Operation Restrained</h4>
                  <p className="text-xs text-red-700/95 mt-1">{error}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-brand-blue-50 border border-brand-blue-50 rounded-2xl flex items-start gap-3 text-brand-blue text-sm font-medium">
                <CheckCircle className="w-5 h-5 text-brand-blue shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-emerald-900">Success Acknowledged</h4>
                  <p className="text-xs text-brand-blue/95 mt-1">{actionSuccessMessage}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header & Navigation */}
      <div className="print:hidden bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${activeTab === 'analytics' ? 'bg-brand-blue text-white shadow-md' : 'bg-gray-50 text-brand-charcoal hover:bg-gray-100 border border-gray-200'}`}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button onClick={() => setActiveTab('lots')} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${activeTab === 'lots' ? 'bg-brand-blue text-white shadow-md' : 'bg-gray-50 text-brand-charcoal hover:bg-gray-100 border border-gray-200'}`}>
            <Box className="w-4 h-4" /> QR Lots
          </button>
          <button onClick={() => setActiveTab('generator')} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${activeTab === 'generator' ? 'bg-brand-blue text-white shadow-md' : 'bg-gray-50 text-brand-charcoal hover:bg-gray-100 border border-gray-200'}`}>
            <Sparkles className="w-4 h-4" /> Generator
          </button>
          <button onClick={() => setActiveTab('ledger')} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${activeTab === 'ledger' ? 'bg-brand-blue text-white shadow-md' : 'bg-gray-50 text-brand-charcoal hover:bg-gray-100 border border-gray-200'}`}>
            <Users className="w-4 h-4" /> Ledger
          </button>
          <button onClick={() => setActiveTab('export')} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 ${activeTab === 'export' ? 'bg-brand-blue text-white shadow-md' : 'bg-gray-50 text-brand-charcoal hover:bg-gray-100 border border-gray-200'}`}>
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
        <button onClick={syncGlobalData} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-brand-charcoal rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-300 whitespace-nowrap shadow-sm">
          <RefreshCw className={`w-4 h-4 ${(ledgerLoading || analyticsLoading || qrLotsLoading) ? 'animate-spin' : ''}`} />
          Sync Data
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative">
        <AnimatePresence mode="wait">

        {activeTab === 'analytics' && (
          <motion.div key="analytics-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="print:hidden">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-50 flex items-center gap-3">
                <div className="p-3 bg-brand-blue-50 text-brand-blue rounded-2xl"><PieChartIcon className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">Analytics Overview</h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Real-time system metrics</p>
                </div>
              </div>
              <div className="p-6 md:p-8">
                {analyticsLoading ? (
                  <div className="flex justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-brand-blue" /></div>
                ) : analyticsData ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-brand-charcoal text-xs font-bold uppercase mb-1">Generated QRs</div>
                        <div className="text-3xl font-black text-brand-charcoal">{analyticsData.totalGenerated}</div>
                      </div>
                      <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                        <div className="text-blue-500 text-xs font-bold uppercase mb-1">Claimed QRs</div>
                        <div className="text-3xl font-black text-blue-800">{analyticsData.totalClaimed}</div>
                      </div>
                      <div className="p-5 bg-brand-blue-50 rounded-2xl border border-brand-blue-50">
                        <div className="text-brand-blue text-xs font-bold uppercase mb-1">Active Wallet Pts</div>
                        <div className="text-3xl font-black text-brand-blue">{analyticsData.totalActivePoints}</div>
                      </div>
                      <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
                        <div className="text-red-500 text-xs font-bold uppercase mb-1">Zeroed Out Pts</div>
                        <div className="text-3xl font-black text-red-700">{analyticsData.totalZeroedPoints}</div>
                      </div>
                    </div>
                    <div className="h-[350px] w-full flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={[
                            { name: 'Unclaimed QRs', value: Math.max(0, analyticsData.totalGenerated - analyticsData.totalClaimed), color: '#CBD5E1' },
                            { name: 'Claimed QRs', value: analyticsData.totalClaimed, color: '#4F46E5' }
                          ]} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                            {[{color: '#CBD5E1'}, {color: '#4F46E5'}].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-brand-charcoal text-center p-8">No data available.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'lots' && (
          <motion.div key="lots-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="print:hidden">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-50 flex items-center gap-3">
                <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl"><Box className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">QR Lot Registry</h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Aggregate view by batch generation</p>
                </div>
              </div>
              {qrLotsLoading ? (
                <div className="flex justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-fuchsia-500" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-brand-charcoal text-[10px] font-bold uppercase tracking-widest">
                        <th className="py-3 px-6">Lot No.</th>
                        <th className="py-3 px-6">Total QRs</th>
                        <th className="py-3 px-6">Claimed QRs</th>
                        <th className="py-3 px-6">Claim Rate</th>
                        <th className="py-3 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {qrLotsData.map(lot => (
                        <React.Fragment key={lot.lotNumber}>
                          <tr className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setExpandedLot(expandedLot === lot.lotNumber ? null : lot.lotNumber)}>
                            <td className="py-4 px-6 font-black text-brand-charcoal font-mono text-sm">LOT {String(lot.lotNumber).padStart(3, '0')}</td>
                            <td className="py-4 px-6 text-brand-charcoal font-bold text-sm">{lot.totalTokens}</td>
                            <td className="py-4 px-6 text-brand-blue font-black text-sm">{lot.claimedTokens}</td>
                            <td className="py-4 px-6 text-brand-charcoal">
                              <div className="w-full bg-gray-200 rounded-full h-2 max-w-[120px] mt-0.5 overflow-hidden">
                                <div className="bg-brand-blue h-2 rounded-full" style={{ width: `${lot.totalTokens > 0 ? (lot.claimedTokens / lot.totalTokens) * 100 : 0}%` }}></div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <span className="text-xs font-bold text-brand-blue bg-brand-blue-50 px-3 py-1.5 rounded-lg">{expandedLot === lot.lotNumber ? 'Hide' : 'View Scans'}</span>
                            </td>
                          </tr>
                          {expandedLot === lot.lotNumber && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50 p-0 border-b border-gray-200">
                                <div className="p-6 border-l-4 border-brand-blue max-h-[400px] overflow-y-auto">
                                  {lot.tokens.filter(t => t.used).length === 0 ? (
                                    <div className="text-center p-6 bg-white rounded-xl border border-dashed border-gray-200">
                                      <p className="text-sm font-semibold text-brand-charcoal">No QRs from this lot have been scanned yet.</p>
                                    </div>
                                  ) : (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                      <table className="w-full text-sm text-left">
                                        <thead>
                                          <tr className="bg-gray-50 text-gray-400 font-bold text-[10px] uppercase tracking-wider border-b border-gray-100">
                                            <th className="py-2.5 px-4">User</th>
                                            <th className="py-2.5 px-4">Phone</th>
                                            <th className="py-2.5 px-4">Points</th>
                                            <th className="py-2.5 px-4">Date Scanned</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {lot.tokens.filter(t => t.used).map((t, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                              <td className="py-3 px-4 font-bold text-brand-charcoal">{t.claimantName}</td>
                                              <td className="py-3 px-4 text-brand-charcoal font-mono text-xs">{t.claimedBy}</td>
                                              <td className="py-3 px-4 text-brand-blue font-black">+{t.points}</td>
                                              <td className="py-3 px-4 text-gray-400 text-xs">{t.claimedAt ? new Date(t.claimedAt).toLocaleString('en-IN') : ''}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {qrLotsData.length === 0 && !qrLotsLoading && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-brand-charcoal font-medium">No QR Lots generated yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'export' && (
          <motion.div key="export-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="print:hidden">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-50 flex items-center gap-3">
                <div className="p-3 bg-brand-blue-50 text-brand-blue rounded-2xl"><Download className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">Data Export Engine</h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Download full CSV reports for Excel/Sheets</p>
                </div>
              </div>
              <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                <form onSubmit={handleExport} className="w-full max-w-md space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-brand-charcoal uppercase tracking-wider mb-2">Start Date (Optional)</label>
                    <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm font-semibold text-brand-charcoal transition-all focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-charcoal uppercase tracking-wider mb-2">End Date (Optional)</label>
                    <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm font-semibold text-brand-charcoal transition-all focus:bg-white" />
                  </div>
                  <button type="submit" disabled={exportLoading} className="w-full py-4 bg-brand-blue hover:bg-brand-blue active:bg-brand-blue disabled:bg-emerald-300 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm">
                    {exportLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    Download CSV Report
                  </button>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">Export includes QR Lot, Claimant details, Scan Dates, and Zeroed Out statuses.</p>
                </form>
                <div className="hidden md:flex flex-col items-center justify-center flex-1 bg-brand-blue-50/50 rounded-2xl border border-brand-blue-50 border-dashed p-8 text-center">
                  <div className="w-20 h-20 bg-brand-blue-50 text-brand-blue rounded-full flex items-center justify-center mb-4">
                    <Download className="w-10 h-10" />
                  </div>
                  <h4 className="text-emerald-900 font-bold text-lg mb-2">Secure Export</h4>
                  <p className="text-brand-blue text-sm max-w-[250px]">Filter by date range to download precise subsets of your QR ledger, or leave blank to export the entire history.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'generator' && (
          <motion.div key="generator-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      {/* Section 1: The QR Generator (Top) */}
      <div className="print:hidden w-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">QR Incentive Generator</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Section 1: Interactive Token Provisioning</p>
            </div>
          </div>
          <span className="self-start sm:self-center px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 font-mono text-[10px] font-bold uppercase rounded-full">
            Localhost & Sandbox Dynamic Ready
          </span>
        </div>

        <div className="p-6 md:p-8 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Input form panel code */}
            <form onSubmit={handleBulkGenerate} className="md:col-span-5 space-y-5 bg-white p-6 border border-gray-100 rounded-2xl">
              <div>
                <label htmlFor="points-input-box" className="block text-xs font-bold text-brand-charcoal uppercase tracking-wider mb-2">
                  Points per QR Code
                </label>
                <div className="relative">
                  <input
                    id="points-input-box"
                    type="number"
                    min="1"
                    required
                    disabled={loading}
                    value={pointsToAward}
                    onChange={(e) => {
                      console.log('[INPUT] pointsToAward changed to:', e.target.value);
                      setPointsToAward(Math.max(1, parseInt(e.target.value) || 1));
                    }}
                    className="w-full pl-4 pr-16 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-bold text-brand-charcoal text-base"
                    placeholder="e.g. 15"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold font-mono">
                    Points
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                  The reward value added to a user's wallet when they scan this QR.
                </p>
              </div>

              <div>
                <label htmlFor="quantity-input-box" className="block text-xs font-bold text-brand-charcoal uppercase tracking-wider mb-2">
                  Quantity (Max 50)
                </label>
                <div className="relative">
                  <input
                    id="quantity-input-box"
                    type="number"
                    min="1"
                    max="50"
                    required
                    disabled={loading}
                    value={quantity}
                    onChange={(e) => {
                      console.log('[INPUT] quantity changed to:', e.target.value);
                      setQuantity(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)));
                    }}
                    className="w-full pl-4 pr-16 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-bold text-brand-charcoal text-base"
                    placeholder="e.g. 10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold font-mono">
                    Qty
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                  We enforce a strict hard limit of 50 codes per print batch for optimal system performance.
                </p>
              </div>

              <div>
                <label htmlFor="base-url-input-box" className="block text-xs font-bold text-brand-charcoal uppercase tracking-wider mb-2">
                  Scan Base URL (Domain)
                </label>
                <div className="relative">
                  <input
                    id="base-url-input-box"
                    type="text"
                    required
                    disabled={loading}
                    value={qrBaseUrl}
                    onChange={(e) => {
                      console.log('[INPUT] qrBaseUrl changed to:', e.target.value);
                      setQrBaseUrl(e.target.value);
                    }}
                    className="w-full pl-4 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-xs text-brand-charcoal"
                    placeholder="e.g. http://192.168.1.15:3000"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                  Defaults to current page. Override with your computer's local Wi-Fi IP (e.g. <code>http://192.168.1.15:3000</code>) for phone testing on Localhost or your custom Render URL!
                </p>
              </div>

              <button
                id="generate-qr-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting backend...
                  </>
                ) : (
                  'Generate QR Codes'
                )}
              </button>
            </form>

            {/* Generated display results panel */}
            <div className="md:col-span-7 flex flex-col items-center justify-center min-h-[200px]">
              {generatedQrs.length > 0 ? (
                <div className="w-full flex flex-col items-center">
                  
                  {/* Visual batch header */}
                  <div className="w-full text-brand-charcoal text-xs font-mono mb-3 flex items-center justify-between">
                    <span>Active Batch: {generatedQrs.length} Codes Created</span>
                    <span className="font-bold text-amber-700">★ {generatedPoints} PTS EACH</span>
                  </div>

                  {/* Scrollable container for preview on screen */}
                  <div className="w-full max-h-[360px] overflow-y-auto border border-gray-200/60 rounded-2xl bg-white p-4 space-y-4">
                    {/* Visual grid for screen preview */}
                    <div className="grid grid-cols-2 gap-4">
                      {generatedQrs.map((tokenObj, index) => {
                        const uid = tokenObj.uid || tokenObj;
                        const lotNumber = tokenObj.lotNumber || 0;
                        const claimUrl = `${qrBaseUrl}/claim?token=${uid}`;
                        return (
                          <div key={uid} className="p-3 bg-slate-50/50 border border-gray-100 rounded-xl flex flex-col items-center justify-center relative group">
                            <span className="absolute top-1.5 left-1.5 text-[8px] bg-slate-200 font-mono text-brand-charcoal font-bold px-1.5 py-0.5 rounded-sm">
                              LOT {String(lotNumber).padStart(3, '0')}
                            </span>
                            <div className="p-1 bg-white border border-gray-100 rounded-lg">
                              <QRCodeSVG
                                value={claimUrl}
                                size={80}
                                level="M"
                                includeMargin={true}
                              />
                            </div>
                            <span className="mt-2 inline-block px-2 py-0.5 bg-amber-50 text-amber-700 font-bold text-[9px] rounded-full">
                              {generatedPoints} PTS
                            </span>
                            <code className="text-[7px] text-gray-400 select-all font-mono mt-1 w-full truncate text-center block px-1">
                              {uid.substring(0, 8)}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                console.log('[SIMULATE CLAIM] Triggering claim simulation for Token:', uid);
                                window.history.pushState({}, '', `/claim?token=${uid}`);
                                window.dispatchEvent(new Event('popstate'));
                              }}
                              className="mt-2 w-full py-1 text-[9px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors font-sans"
                            >
                              Simulate Claim
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Batch actions - print:hidden */}
                  <div className="w-full mt-4 space-y-2.5">
                    {/* Trigger Print for All Generated Cards */}
                    <button
                      id="trigger-bulk-print-btn"
                      onClick={() => {
                        console.log('[PRINT] Triggering system print dialogue...');
                        handlePrint();
                      }}
                      className="w-full py-3 bg-gray-950 hover:bg-brand-charcoal text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-xs cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-gray-300" />
                      Print All QR codes to Grid (A4)
                    </button>

                    <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                      💡 Click <strong>Simulate Claim</strong> on any preview card above to instantly route and claim those points inside this sandbox session!
                    </p>
                  </div>

                </div>
              ) : (
                <div className="text-center p-8 bg-white border border-dashed border-gray-200/80 rounded-2xl w-full max-w-sm flex flex-col items-center justify-center">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl mb-3">
                    <QRCodeSVG value="https://google.com" size={70} className="mx-auto opacity-20" />
                  </div>
                  <h4 className="text-sm font-semibold text-brand-charcoal">QR Code Preview</h4>
                  <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                    Configure quantity and points value then trigger generation to render.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Embedded print view container when multiple codes exist */}
      {generatedQrs.length > 0 && (
        <div className="hidden print:block">
          <div id="printable-grid-frame">
            {generatedQrs.map((tokenObj) => {
              const uid = tokenObj.uid || tokenObj;
              const lotNumber = tokenObj.lotNumber || 0;
              const claimUrl = `${qrBaseUrl}/claim?token=${uid}`;
              return (
                <div key={uid} className="no-print-border w-[220px] bg-white rounded-[20px] flex flex-col overflow-hidden relative m-2" style={{ border: '2px dashed #CBD5E1' }}>
                  <div className="w-full bg-[#4045CB] text-white py-2 flex items-center justify-center">
                    <span className="font-black tracking-widest text-[10px] uppercase">My Scan Rewards</span>
                  </div>
                  <div className="p-3 flex flex-col items-center bg-white">
                    <div className="p-1 border border-gray-100 rounded-xl mb-2">
                      <QRCodeSVG
                        value={claimUrl}
                        size={120}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%234045CB'/%3E%3Ctext x='50' y='70' font-family='sans-serif' font-size='60' font-weight='900' fill='white' text-anchor='middle'%3EM%3C/text%3E%3C/svg%3E",
                          height: 30,
                          width: 30,
                          excavate: true,
                        }}
                      />
                    </div>
                    <div className="text-center w-full">
                      <div className="text-[#FB734E] font-black text-lg uppercase tracking-tight leading-none mb-1">
                        GET {generatedPoints} PTS!
                      </div>
                      <p className="text-[#1D1E6B] font-bold text-[9px] tracking-widest uppercase mt-2 mb-2">
                        Scan To Claim
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-50 py-1.5 px-3 flex items-center justify-between border-t border-dashed border-gray-200">
                    <span className="text-[9px] font-black text-brand-charcoal font-mono">
                      LOT {String(lotNumber).padStart(3, '0')}
                    </span>
                    <span className="text-[7px] text-gray-400 font-mono">
                      ID:{uid.substring(0, 8)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </motion.div>
      )}

      {activeTab === 'ledger' && (
      <motion.div key="ledger-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      {/* Section 2 & 3: Animated Views */}
      <div className="relative mt-6">
        <AnimatePresence mode="wait">
          {activeView === 'ledger' && (
            <motion.div 
              key="ledger-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="print:hidden w-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"
            >
          <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-blue-50 text-brand-blue rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">Beneficiary Ledger</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Section 2: Active Clients & Accumulated Balances</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Real-time Refresh Ledger Above the Table */}
            <button
              onClick={fetchLedger}
              className="px-4 py-2.5 bg-brand-blue-50 hover:bg-brand-blue-50 text-brand-blue font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer border border-brand-blue-50/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ledgerLoading ? 'animate-spin' : ''}`} />
              Refresh Ledger
            </button>

            {/* Real-time search filter */}
            <div className="relative max-w-xs w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search by name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent text-xs font-semibold text-brand-charcoal transition-all"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Data Table Area */}
        {ledgerLoading && beneficiaries.length === 0 ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-blue mx-auto" />
            <p className="text-sm font-semibold text-brand-charcoal mt-3 font-mono">Synchronizing ledger tables...</p>
          </div>
        ) : filteredBeneficiaries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-brand-charcoal text-xs font-medium uppercase tracking-wide">
                  <th className="py-3 px-6 font-medium align-top">
                    <div className="mb-2 text-[11px] font-bold">Name</div>
                    <input
                      type="text"
                      placeholder="Filter by name..."
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-blue text-[11px] font-semibold text-brand-charcoal normal-case shadow-sm placeholder:font-normal"
                    />
                  </th>
                  <th className="py-3 px-6 font-medium align-top">
                    <div className="mb-2 text-[11px] font-bold">Mobile Number</div>
                    <input
                      type="text"
                      placeholder="Filter by phone..."
                      value={phoneFilter}
                      onChange={(e) => setPhoneFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-blue text-[11px] font-semibold text-brand-charcoal normal-case shadow-sm placeholder:font-normal"
                    />
                  </th>
                  <th className="py-3 px-6 font-medium align-top">
                    <div className="mb-2 text-[11px] font-bold">Total Points</div>
                    <input
                      type="number"
                      placeholder="Min points..."
                      value={minPointsFilter}
                      onChange={(e) => setMinPointsFilter(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-24 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-blue text-[11px] font-semibold text-brand-charcoal normal-case shadow-sm placeholder:font-normal"
                    />
                  </th>
                  <th className="py-3 px-6 font-medium text-right align-top">
                    <div className="mb-2 text-[11px] font-bold">Action</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredBeneficiaries.map((b, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => fetchUserHistory(b.phone)}
                    className="hover:bg-gray-50 transition-colors text-sm cursor-pointer"
                  >
                    <td className="py-4 px-6 text-brand-charcoal flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-medium text-brand-charcoal">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{b.name}</span>
                    </td>
                    <td className="py-4 px-6 text-brand-charcoal">
                      {b.phone}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-brand-charcoal">
                        {b.points} <span className="text-brand-charcoal font-normal">pts</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); initiateResetPoints(b.phone, b.name); }}
                        className="py-1.5 px-3 bg-white hover:bg-red-50 text-red-600 border border-gray-200 rounded-lg shadow-sm transition-all active:scale-95 text-xs font-medium inline-flex items-center justify-center gap-1.5 ml-auto cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Zero Out
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl mb-3">
              <Users className="w-8 h-8 opacity-40" />
            </div>
            <h4 className="text-sm font-semibold text-brand-charcoal">No Customers Found</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
              No clients matched your current filter criteria or the ledger is currently empty. Authenticated customer accounts register in the ledger on creation.
            </p>
          </div>
        )}

        <div className="p-6 md:p-8 bg-slate-50/20 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-gray-400 font-mono">
            <Coins className="w-4 h-4 text-slate-400" />
            <span>Accumulation Metrics: {beneficiaries.length} total users tracked</span>
          </div>
          <button
            id="refresh-ledger-btn"
            onClick={fetchLedger}
            className="self-start sm:self-auto py-2 px-3.5 bg-slate-100 hover:bg-slate-200 hover:text-brand-charcoal transition-all active:scale-95 font-semibold text-brand-charcoal rounded-xl flex items-center justify-center gap-2.5 cursor-pointer border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ledgerLoading ? 'animate-spin' : ''}`} />
            Refresh Ledger Data
          </button>
        </div>
          </motion.div>
          )}

          {/* Section 3: User Detail View */}
          {activeView === 'userDetail' && selectedUser && (
            <motion.div 
              key="user-detail-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="print:hidden w-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"
            >
          <div className="p-6 md:p-8 border-b border-gray-50 flex items-center gap-4">
            <button 
              onClick={() => setActiveView('ledger')}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all active:scale-95 cursor-pointer text-brand-charcoal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-blue-50 border-2 border-brand-blue-50 flex items-center justify-center text-lg font-bold text-brand-blue">
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-brand-charcoal tracking-tight">{selectedUser.name}</h2>
                <div className="flex items-center gap-3 text-sm text-brand-charcoal mt-1">
                  <span className="flex items-center gap-1"><Smartphone className="w-4 h-4" /> {selectedUser.phone}</span>
                  <span>•</span>
                  <span className="font-semibold text-brand-blue">Current Balance: {selectedUser.points} pts</span>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); initiateResetPoints(selectedUser.phone, selectedUser.name); }}
              className="ml-auto py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm rounded-xl transition-all active:scale-95 cursor-pointer border border-red-200/50 flex items-center gap-2"
            >
              <UserMinus className="w-4 h-4" />
              Zero Out Balance
            </button>
          </div>
          
          <div className="p-6 md:p-8">
            <h3 className="text-lg font-bold text-brand-charcoal mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-gray-400" />
              QR Scan History
            </h3>
            
            {historyLoading ? (
              <div className="p-16 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-brand-blue mx-auto" />
                <p className="text-sm font-semibold text-brand-charcoal mt-3">Loading records...</p>
              </div>
            ) : userHistory.length === 0 ? (
              <div className="p-12 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                <p className="text-sm font-medium text-brand-charcoal">No scans recorded for this user yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-brand-charcoal text-xs font-medium uppercase tracking-wide">
                      <th className="py-3 px-6 font-medium">QR Token</th>
                      <th className="py-3 px-6 font-medium">Lot No.</th>
                      <th className="py-3 px-6 font-medium">Date Scanned</th>
                      <th className="py-3 px-6 font-medium">Points</th>
                      <th className="py-3 px-6 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {userHistory.map((item, idx) => (
                      <tr key={item.uid || idx} className={`transition-colors text-sm ${item.zeroedOut ? 'bg-red-50/30' : 'hover:bg-gray-50'}`}>
                        <td className="py-4 px-6 font-mono text-brand-charcoal">
                          {item.uid ? item.uid.slice(0, 8) + '...' : 'UNKNOWN'}
                        </td>
                        <td className="py-4 px-6 font-mono text-brand-charcoal font-bold">
                          {String(item.lotNumber).padStart(3, '0')}
                        </td>
                        <td className="py-4 px-6 text-brand-charcoal flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.claimedAt ? new Date(item.claimedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                        </td>
                        <td className={`py-4 px-6 font-semibold ${item.zeroedOut ? 'text-gray-400 line-through' : 'text-brand-charcoal'}`}>
                          +{item.points} pts
                        </td>
                        <td className="py-4 px-6 text-right">
                          {item.zeroedOut ? (
                            <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider border border-red-200">
                              Zeroed Out
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-brand-blue-50 text-brand-blue text-[10px] font-bold rounded-full uppercase tracking-wider border border-brand-blue-50">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      </div>
      </motion.div>
      )}

      </AnimatePresence>
      </div>

      {/* Section 3: Diagnostic Trace Console */}
      <div className="print:hidden w-full bg-brand-charcoal text-slate-100 border border-brand-charcoal rounded-3xl shadow-lg overflow-hidden font-mono mt-8">
        <div className="p-4 md:px-6 bg-slate-950 border-b border-brand-charcoal flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-brand-blue"></div>
            <span className="text-xs font-bold text-slate-400 pl-2">System Diagnostics Console</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setDiagnosticLogs([]);
                const timeStr = new Date().toLocaleTimeString();
                setDiagnosticLogs([`[${timeStr}] [SYSTEM] Diagnostic logs reset by Administrator.`]);
              }}
              className="px-2.5 py-1 hover:bg-brand-charcoal hover:text-white transition-colors text-[10px] text-slate-400 border border-brand-charcoal rounded-md cursor-pointer"
            >
              Clear Logs
            </button>
            <button
              onClick={() => {
                setShowLogs(!showLogs);
              }}
              className="px-2.5 py-1 hover:bg-brand-charcoal hover:text-white transition-colors text-[10px] text-slate-400 border border-brand-charcoal rounded-md cursor-pointer"
            >
              {showLogs ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {showLogs && (
          <div className="p-4 md:p-6 bg-brand-charcoal/90 text-[11px] leading-relaxed max-h-60 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {diagnosticLogs.length > 0 ? (
              diagnosticLogs.map((logStr, idx) => {
                let colorClass = 'text-slate-300';
                if (logStr.includes('[ERROR]')) colorClass = 'text-rose-400 font-semibold';
                if (logStr.includes('[SUCCESS]')) colorClass = 'text-emerald-400 font-semibold';
                if (logStr.includes('[ACTION]')) colorClass = 'text-blue-300';
                if (logStr.includes('[NETWORK]')) colorClass = 'text-brand-blue-50';
                if (logStr.includes('[WARNING]')) colorClass = 'text-amber-400';
                
                return (
                  <div key={idx} className={`${colorClass} whitespace-pre-wrap select-all`}>
                    {logStr}
                  </div>
                );
              })
            ) : (
              <div className="text-brand-charcoal italic text-center py-4">
                No telemetry traces generated yet. Perform dashboard operations above to view diagnostic logs.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stateful interactive confirmation modal */}
      <AnimatePresence>
        {resetConfirmation && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white border border-gray-100 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Alert Header */}
              <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
                <div className="p-3 bg-red-100/80 text-red-600 rounded-2xl">
                  <UserMinus className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brand-charcoal">Authorize Cash Payout</h3>
                  <p className="text-xs text-red-700 font-bold mt-0.5 font-mono">CRITICAL DATABASE WRITE</p>
                </div>
              </div>

              {/* Client specifications and notice */}
              <div className="p-6 md:p-8 space-y-5">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2.5">Beneficiary Credentials</p>
                  <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Name:</span>
                      <span className="font-extrabold text-brand-charcoal">{resetConfirmation.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Mobile Number:</span>
                      <span className="font-mono font-bold text-brand-charcoal">{resetConfirmation.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-amber-900 text-xs leading-relaxed">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong>Action Required:</strong> Please ensure that you physical log this payout, hand the cash or rewards equivalent to the customer, and then authorize below to clear their accrued points ledger on the live database.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-slate-50 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelResetPoints}
                  className="px-4 py-2.5 bg-white hover:bg-gray-100 text-brand-charcoal font-bold rounded-xl text-xs transition-colors cursor-pointer border border-gray-200"
                >
                  Keep Points Balance
                </button>
                <button
                  type="button"
                  onClick={executeResetPoints}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm Payout & Zero Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
