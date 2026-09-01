import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  LayoutDashboard,
  QrCode,
  Clock
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
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger', 'generator', 'lots'
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

  // Inline confirmation state for zeroing out points
  const [confirmZeroOutPhone, setConfirmZeroOutPhone] = useState(null);

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
      
      const fileName = `qrs_export_${new Date().getTime()}.csv`;
      
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share } = await import('@capacitor/share');
          
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: csvContent,
            directory: Directory.Cache,
            encoding: 'utf8'
          });
          
          await Share.share({
            title: 'Exported QR CSV',
            text: 'Here is the exported CSV file.',
            url: savedFile.uri,
            dialogTitle: 'Share CSV'
          });
        } else {
          // Web fallback
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } catch (nativeErr) {
        console.warn('Native CSV export failed, falling back to web.', nativeErr);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
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

  // 3. Confirm points reset execution (Inline)
  const executeResetPoints = async (phone, name) => {
    addLog('action', `Confirmed payout zero-out inline. Sending execution command to backend database proxy for "${name}" (${phone})`);
    setConfirmZeroOutPhone(null);
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
        
        const printArea = document.querySelector('#printable-grid-frame') || document.body;
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
        @media screen {
          /* Off-screen during normal view - portal is in DOM but invisible */
          #printable-grid-frame-wrapper {
            position: fixed;
            left: -9999px;
            top: -9999px;
            pointer-events: none;
            width: 800px;
          }
        }
        @media print {
          /* Hide the React app root - NOT body > * which would hide the portal too */
          #root {
            display: none !important;
          }
          /* Show only the portalled print grid (it's a sibling of #root, direct child of body) */
          #printable-grid-frame-wrapper {
            display: block !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            pointer-events: auto !important;
          }
          #printable-grid-frame {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
            padding: 10px !important;
            background: white !important;
          }
          .qr-print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background-color: #ffffff !important;
            box-shadow: none !important;
            overflow: visible !important;
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
      {(() => {
        const adminTabs = (
          <div className="w-full lg:w-auto grid grid-cols-3 lg:flex gap-1 lg:gap-2 bg-slate-100 lg:bg-transparent p-1.5 lg:p-0 rounded-2xl lg:rounded-none">
            <button onClick={() => setActiveTab('ledger')} className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 px-1 py-2 lg:px-4 lg:py-2.5 rounded-xl text-[11px] sm:text-xs lg:text-sm font-bold transition-all active:scale-95 ${activeTab === 'ledger' ? 'bg-white lg:bg-[#11358B] text-[#11358B] lg:text-white shadow-sm lg:shadow-md' : 'bg-transparent text-gray-500 hover:text-[#11358B] lg:text-[#11358B] lg:hover:bg-white/40 border border-transparent'}`}>
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 lg:w-4 lg:h-4" /> <span className="whitespace-nowrap">Dashboard</span>
            </button>
            <button onClick={() => setActiveTab('lots')} className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 px-1 py-2 lg:px-4 lg:py-2.5 rounded-xl text-[11px] sm:text-xs lg:text-sm font-bold transition-all active:scale-95 ${activeTab === 'lots' ? 'bg-white lg:bg-[#11358B] text-[#11358B] lg:text-white shadow-sm lg:shadow-md' : 'bg-transparent text-gray-500 hover:text-[#11358B] lg:text-[#11358B] lg:hover:bg-white/40 border border-transparent'}`}>
              <Box className="w-5 h-5 sm:w-6 sm:h-6 lg:w-4 lg:h-4" /> <span className="whitespace-nowrap">QR Lots</span>
            </button>
            <button onClick={() => setActiveTab('generator')} className={`flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-2 px-1 py-2 lg:px-4 lg:py-2.5 rounded-xl text-[11px] sm:text-xs lg:text-sm font-bold transition-all active:scale-95 ${activeTab === 'generator' ? 'bg-white lg:bg-[#11358B] text-[#11358B] lg:text-white shadow-sm lg:shadow-md' : 'bg-transparent text-gray-500 hover:text-[#11358B] lg:text-[#11358B] lg:hover:bg-white/40 border border-transparent'}`}>
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 lg:w-4 lg:h-4" /> <span className="whitespace-nowrap">Generator</span>
            </button>
          </div>
        );

        const portalElement = document.getElementById('admin-navbar-portal');

        return (
          <>
            {portalElement && createPortal(adminTabs, portalElement)}
            
            <div className="print:hidden flex lg:hidden flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              {adminTabs}
            </div>
          </>
        );
      })()}

      {/* Main Content Area */}
      <div className="relative">
        <AnimatePresence mode="wait">

        {activeTab === 'lots' && (
          <motion.div key="lots-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="print:hidden">
            <div className="bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden">
              <div className="p-6 md:p-8 border-b border-gray-50 flex items-center gap-3">
                <div className="p-3 bg-brand-blue-50 text-brand-blue rounded-2xl"><Box className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">QR Lot Registry</h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Aggregate view by batch generation</p>
                </div>
              </div>
              {qrLotsLoading ? (
                <div className="flex justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-brand-blue" /></div>
              ) : (
                <div className="flex-1 w-full bg-white md:rounded-b-[24px]">
                  {/* Desktop Header */}
                  <div className="hidden md:grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)] border-b border-t border-gray-300 text-[#11358B] text-xs font-bold uppercase tracking-widest bg-[#F8FAFC] divide-x divide-gray-300">
                    <div className="px-6 py-4">Lot No.</div>
                    <div className="px-6 py-4">Total QRs</div>
                    <div className="px-6 py-4">Claimed QRs</div>
                    <div className="px-6 py-4">Claim Rate</div>
                    <div className="px-6 py-4 text-right">Action</div>
                  </div>

                  {/* Grid Body */}
                  <div className="flex flex-col divide-y divide-gray-300 bg-white md:rounded-b-[24px]">
                    {qrLotsData.map(lot => (
                      <React.Fragment key={lot.lotNumber}>
                        <div 
                          className="hover:bg-[#F8FAFC]/60 cursor-pointer transition-colors flex flex-col md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)] md:items-stretch md:divide-x md:divide-gray-300"
                          onClick={() => setExpandedLot(expandedLot === lot.lotNumber ? null : lot.lotNumber)}
                        >
                          {/* Mobile Layout / Col 1 */}
                          <div className="flex items-center justify-between p-4 md:px-6 md:py-4">
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#11358B] text-white flex items-center justify-center shrink-0 shadow-sm">
                                <QrCode className="w-4 h-4 md:w-5 md:h-5" />
                              </div>
                              <p className="font-extrabold text-[#11358B] text-sm md:text-base leading-tight">
                                LOT {String(lot.lotNumber).padStart(3, '0')}
                              </p>
                            </div>
                            {/* Action on Mobile */}
                            <div className="md:hidden flex items-center shrink-0">
                              <span className="whitespace-nowrap text-xs font-bold text-[#11358B] bg-[#C7EF66] hover:bg-[#11358B] hover:text-[#C7EF66] px-4 py-2 min-h-[44px] rounded-xl flex items-center justify-center cursor-pointer shadow-sm transition-colors">
                                {expandedLot === lot.lotNumber ? 'Hide' : 'View Scans'}
                              </span>
                            </div>
                          </div>

                          {/* Mobile Stats / Cols 2, 3, 4 */}
                          <div className="grid grid-cols-2 gap-4 p-4 border-t border-gray-100 md:hidden bg-gray-50/50">
                            <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Total QRs</p>
                              <p className="font-extrabold text-[#11358B] text-lg">{lot.totalTokens}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Claimed QRs</p>
                              <p className="font-extrabold text-[#6192FC] text-lg">{lot.claimedTokens}</p>
                            </div>
                            <div className="col-span-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-bold text-gray-500 uppercase text-[10px]">Claim Rate</span>
                                <span className="font-extrabold text-[#11358B]">{lot.totalTokens > 0 ? Math.round((lot.claimedTokens / lot.totalTokens) * 100) : 0}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                                <div className="bg-[#6192FC] h-2 rounded-full" style={{ width: `${lot.totalTokens > 0 ? (lot.claimedTokens / lot.totalTokens) * 100 : 0}%` }}></div>
                              </div>
                            </div>
                          </div>

                          {/* Desktop Cols 2, 3, 4, 5 */}
                          <div className="hidden md:flex items-center px-6 py-4 font-extrabold text-base text-[#11358B]">{lot.totalTokens}</div>
                          <div className="hidden md:flex items-center px-6 py-4 font-extrabold text-base text-[#6192FC]">{lot.claimedTokens}</div>
                          <div className="hidden md:flex flex-col justify-center px-6 py-4">
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Progress</span>
                              <span className="font-extrabold text-[#11358B]">{lot.totalTokens > 0 ? Math.round((lot.claimedTokens / lot.totalTokens) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                              <div className="bg-[#6192FC] h-2 rounded-full transition-all duration-500" style={{ width: `${lot.totalTokens > 0 ? (lot.claimedTokens / lot.totalTokens) * 100 : 0}%` }}></div>
                            </div>
                          </div>
                          <div className="hidden md:flex items-center justify-end px-6 py-4">
                            <span className="whitespace-nowrap text-xs font-bold text-[#11358B] bg-[#C7EF66] hover:bg-[#11358B] hover:text-[#C7EF66] px-5 py-2.5 min-h-[44px] rounded-xl flex items-center justify-center cursor-pointer shadow-sm transition-colors">
                              {expandedLot === lot.lotNumber ? 'Hide' : 'View Scans'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Expanded Scans Grid */}
                        {expandedLot === lot.lotNumber && (
                          <div className="bg-slate-50 border-b border-gray-200">
                            <div className="p-4 md:p-6 border-l-4 border-[#6192FC] max-h-[400px] overflow-y-auto">
                              {lot.tokens.filter(t => t.used).length === 0 ? (
                                <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-gray-200">
                                  <p className="text-sm font-bold text-[#11358B]">No QRs from this lot have been scanned yet.</p>
                                </div>
                              ) : (
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                  {/* Inner Desktop Header */}
                                  <div className="hidden md:grid grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,2fr)] border-b border-gray-300 text-[#11358B] text-xs font-bold uppercase tracking-widest bg-[#F8FAFC] divide-x divide-gray-300">
                                    <div className="px-6 py-4">User</div>
                                    <div className="px-6 py-4">Date Scanned</div>
                                    <div className="px-6 py-4 text-right">Points</div>
                                  </div>
                                  
                                  <div className="flex flex-col divide-y divide-gray-300">
                                    {lot.tokens.filter(t => t.used).map((t, idx) => (
                                      <div key={idx} className="relative hover:bg-[#F8FAFC]/60 transition-colors flex flex-col md:grid md:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,2fr)] md:items-stretch md:divide-x md:divide-gray-300">
                                        {/* Col 1 */}
                                        <div className="flex items-center gap-3 md:gap-4 p-4 md:px-6 md:py-4">
                                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] bg-[#EFF0F4] text-[#11358B] flex items-center justify-center shrink-0 shadow-sm font-black text-lg">
                                            {t.claimantName ? t.claimantName.charAt(0).toUpperCase() : '?'}
                                          </div>
                                          <div className="flex flex-col">
                                            <p className="font-extrabold text-[#11358B] text-sm md:text-base leading-tight">{t.claimantName}</p>
                                            <p className="font-mono text-gray-500 text-xs mt-0.5">{t.claimedBy}</p>
                                          </div>
                                        </div>
                                        {/* Col 2 */}
                                        <div className="text-[#11358B] flex md:flex-col items-center md:items-start justify-between md:justify-center text-sm ml-[52px] md:ml-0 mt-1 md:mt-0 px-4 pb-4 md:px-6 md:py-4">
                                          <span className="font-bold md:font-extrabold text-gray-700 md:text-[#11358B]">{t.claimedAt ? new Date(t.claimedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                                          <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 md:mt-1"><Clock className="w-3.5 h-3.5" /> {t.claimedAt ? new Date(t.claimedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                        {/* Col 3 */}
                                        <div className="hidden md:flex justify-end items-center font-black text-lg px-6 py-4">
                                          <span className="text-[#6192FC]">+{t.points}</span>
                                        </div>
                                        {/* Mobile Points */}
                                        <div className="absolute right-4 top-4 md:hidden">
                                          <span className="font-black text-lg text-[#6192FC]">+{t.points}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                    {qrLotsData.length === 0 && !qrLotsLoading && (
                      <div className="text-center py-12 text-[#11358B] font-bold">No QR Lots generated yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}



        {activeTab === 'generator' && (
          <motion.div key="generator-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      {/* Section 1: The QR Generator (Top) */}
      <div className="print:hidden w-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-blue-50 text-brand-blue rounded-2xl">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">QR Incentive Generator</h2>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 bg-slate-50 border-b border-gray-100 flex flex-col md:flex-row md:items-center gap-3">
           <label htmlFor="base-url-input-box" className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">
             Scan Base URL
           </label>
           <input
             id="base-url-input-box"
             type="text"
             required
             disabled={loading}
             value={qrBaseUrl}
             onChange={(e) => setQrBaseUrl(e.target.value)}
             className="w-full md:max-w-md pl-4 pr-4 min-h-[44px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11358B] transition-all font-mono text-xs text-[#11358B] shadow-sm font-bold"
             placeholder="e.g. http://192.168.1.15:3000"
           />
        </div>

        <div className="p-6 md:p-8 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            {/* Input form panel code */}
            <form onSubmit={handleBulkGenerate} className="space-y-6 bg-white p-6 md:p-8 border border-gray-100 rounded-3xl shadow-sm">
              <div>
                <label htmlFor="points-input-box" className="block text-xs font-bold text-[#11358B] uppercase tracking-wider mb-2">
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
                      const val = e.target.value;
                      if (val === '0') {
                        setError('Points cannot be 0');
                        setPointsToAward('');
                      } else {
                        setPointsToAward(val === '' ? '' : parseInt(val, 10));
                        setError(null);
                      }
                    }}
                    className="w-full pl-4 pr-16 min-h-[48px] bg-[#F8FAFC] border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#11358B] transition-all font-black text-[#11358B] text-lg md:text-xl shadow-inner"
                    placeholder="e.g. 15"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold font-mono">
                    Points
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="quantity-input-box" className="block text-xs font-bold text-[#11358B] uppercase tracking-wider mb-2">
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
                      const val = e.target.value;
                      if (val === '0') {
                        setError('Quantity cannot be 0');
                        setQuantity('');
                      } else if (val !== '') {
                        const num = parseInt(val, 10);
                        if (num > 50) {
                           setQuantity(50);
                           setError('Maximum quantity is 50');
                        } else {
                           setQuantity(num);
                           setError(null);
                        }
                      } else {
                        setQuantity('');
                        setError(null);
                      }
                    }}
                    className="w-full pl-4 pr-16 min-h-[48px] bg-[#F8FAFC] border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#11358B] transition-all font-black text-[#11358B] text-lg md:text-xl shadow-inner"
                    placeholder="e.g. 10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold font-mono">
                    Qty
                  </span>
                </div>
              </div>

              <button
                id="generate-qr-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-4 min-h-[56px] bg-[#C7EF66] hover:bg-[#11358B] hover:text-[#C7EF66] text-[#11358B] font-black rounded-2xl text-sm md:text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Codes'
                )}
              </button>
            </form>

            {/* Generated display results panel */}
            <div className="flex flex-col items-center justify-center min-h-[200px]">
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
                              className="mt-2 w-full py-1 text-[9px] font-bold text-white bg-brand-blue hover:bg-brand-blue/90 rounded-md transition-colors font-sans"
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

      {/* Print-only grid - portalled into document.body so it's a sibling of #root.
          This is critical: body > * { display:none } will hide #root but NOT this portal div. */}
      {createPortal(
        <div id="printable-grid-frame-wrapper">
          <div id="printable-grid-frame">
            {generatedQrs.map((tokenObj) => {
              const uid = tokenObj.uid || tokenObj;
              const lotNumber = tokenObj.lotNumber || 0;
              const claimUrl = `${qrBaseUrl}/claim?token=${uid}`;
              return (
                <div key={uid} className="qr-print-card" style={{ border: '2px dashed #CBD5E1', width: '220px', backgroundColor: 'white', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', margin: '8px' }}>
                  <div style={{ width: '100%', backgroundColor: '#0078D7', color: 'white', padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontWeight: 900, letterSpacing: '0.15em', fontSize: '10px', textTransform: 'uppercase' }}>Quick Scan Rewards</span>
                  </div>
                  <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'white' }}>
                    <div style={{ padding: '4px', border: '1px solid #F3F4F6', borderRadius: '12px', marginBottom: '8px' }}>
                      <QRCodeSVG
                        value={claimUrl}
                        size={120}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%230078D7'/%3E%3Ctext x='50' y='70' font-family='sans-serif' font-size='60' font-weight='900' fill='white' text-anchor='middle'%3EQ%3C/text%3E%3C/svg%3E",
                          height: 30,
                          width: 30,
                          excavate: true,
                        }}
                      />
                    </div>
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <div style={{ color: '#FB734E', fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '4px' }}>
                        GET {generatedPoints} PTS!
                      </div>
                      <p style={{ color: '#1D1E6B', fontWeight: 700, fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '8px', marginBottom: '8px' }}>
                        Scan To Claim
                      </p>
                    </div>
                  </div>
                  <div style={{ width: '100%', backgroundColor: '#F9FAFB', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #E5E7EB' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, fontFamily: 'monospace' }}>
                      LOT {String(lotNumber).padStart(3, '0')}
                    </span>
                    <span style={{ fontSize: '7px', color: '#9CA3AF', fontFamily: 'monospace' }}>
                      ID:{uid.substring(0, 8)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
      </motion.div>
      )}

      {activeTab === 'ledger' && (
      <motion.div key="ledger-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
        
        <div className="w-full mx-auto flex flex-col gap-6 mt-6 print:hidden">
          {/* ===== TOP ROW: CARDS & ACTIONS ===== */}
          <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {/* Stat 1: Generated QRs */}
            <div className="col-span-1 bg-[#F8FAFC] rounded-3xl p-4 md:p-6 flex flex-col justify-center items-start shadow-sm border border-[#EFF0F4] h-32 md:h-36">
              <h4 className="text-[10px] md:text-xs font-bold text-gray-700 tracking-wider mb-1 md:mb-1.5 uppercase">Generated QRs</h4>
              <p className="text-3xl md:text-4xl font-black text-gray-800">{analyticsData?.totalGenerated || 0}</p>
            </div>
            
            {/* Stat 2: Claimed QRs */}
            <div className="col-span-1 bg-[#F8FAFC] rounded-3xl p-4 md:p-6 flex flex-col justify-center items-start shadow-sm border border-[#EFF0F4] h-32 md:h-36">
              <h4 className="text-[10px] md:text-xs font-bold text-[#11358B] tracking-wider mb-1 md:mb-1.5 uppercase">Claimed QRs</h4>
              <p className="text-3xl md:text-4xl font-black text-[#11358B]">{analyticsData?.totalClaimed || 0}</p>
            </div>

            {/* Pie Chart */}
            <div className="col-span-2 md:col-span-1 bg-white rounded-3xl shadow-sm border border-[#EFF0F4] overflow-hidden flex h-36">
               <div className="flex-1 w-full flex items-center justify-between p-5 md:p-6">
                 {/* Left: Titles & Custom Legend */}
                 <div className="flex flex-col items-start justify-center">
                   <div className="flex items-center gap-2 text-[#11358B] mb-3">
                     <div className="p-2 md:p-1.5 bg-[#F8FAFC] rounded-xl md:rounded-lg"><PieChartIcon className="w-5 h-5 md:w-3.5 md:h-3.5" /></div>
                     <h2 className="text-base md:text-sm font-bold">Claim Status</h2>
                   </div>
                   <div className="flex flex-col gap-2 md:gap-1.5">
                     <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full bg-[#11358B]"></div>
                       <span className="text-sm md:text-xs font-bold text-gray-600">Claimed: {analyticsData?.totalClaimed || 0}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full bg-[#CBD5E1]"></div>
                       <span className="text-sm md:text-xs font-bold text-gray-600">Unclaimed: {Math.max(0, (analyticsData?.totalGenerated || 0) - (analyticsData?.totalClaimed || 0))}</span>
                     </div>
                   </div>
                 </div>
                 
                 {/* Right: Donut */}
                 <div className="h-[90px] w-[90px] md:h-[100px] md:w-[100px] shrink-0">
                   {analyticsLoading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#11358B]" />
                      </div>
                   ) : analyticsData ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={[
                            { name: 'Unclaimed', value: Math.max(0, analyticsData.totalGenerated - analyticsData.totalClaimed), color: '#CBD5E1' },
                            { name: 'Claimed', value: analyticsData.totalClaimed, color: '#11358B' }
                          ]} cx="50%" cy="50%" innerRadius={32} outerRadius={46} paddingAngle={4} dataKey="value" stroke="none">
                            {[{color: '#CBD5E1'}, {color: '#11358B'}].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                          <RechartsTooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                   ) : (
                      <p className="text-xs text-gray-400 text-center mt-8">No data</p>
                   )}
                 </div>
               </div>
            </div>
          </div>

          {/* ===== BOTTOM ROW: MAIN CONTENT ===== */}
          <div className="flex-1 w-full flex flex-col min-w-0">
            <div className="relative">
              <AnimatePresence mode="wait">
                {activeView === 'ledger' && (
                  <motion.div 
                    key="ledger-view"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="w-full bg-white border border-gray-100 rounded-[24px] shadow-xs overflow-hidden"
                  >
          <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-blue-50 text-brand-blue rounded-2xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-charcoal tracking-tight">Beneficiary Ledger</h2>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
            {/* Embedded Export Controls */}
            <form onSubmit={handleExport} className="grid grid-cols-2 md:flex md:flex-row items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100 w-full md:w-auto">
              <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="col-span-1 min-h-[44px] px-3 w-full bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#11358B] text-sm md:text-xs font-semibold text-gray-700 transition-all outline-none" title="Start Date" />
              <span className="hidden md:inline text-gray-400 font-bold text-sm md:text-xs px-1">to</span>
              <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="col-span-1 min-h-[44px] px-3 w-full bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#11358B] text-sm md:text-xs font-semibold text-gray-700 transition-all outline-none" title="End Date" />
              <button type="submit" disabled={exportLoading} className="col-span-2 md:col-span-1 min-h-[44px] px-5 bg-[#C7EF66] text-[#11358B] hover:bg-[#11358B] hover:text-[#C7EF66] font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm md:ml-1 w-full md:w-auto">
                {exportLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export
              </button>
            </form>
          </div>
        </div>

        {/* Dynamic Data Table Area */}
        {ledgerLoading && beneficiaries.length === 0 ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-blue mx-auto" />
            <p className="text-sm font-semibold text-brand-charcoal mt-3 font-mono">Synchronizing ledger tables...</p>
          </div>
        ) : filteredBeneficiaries.length > 0 ? (
          <div className="flex-1 w-full bg-white md:rounded-[24px] border border-gray-200 overflow-hidden shadow-sm">
            {/* 1. The Filter Bar */}
            <div className="p-4 md:p-6 border-b border-gray-200 grid grid-cols-2 md:flex md:flex-row items-center gap-3 bg-[#F8FAFC]">
              <div className="col-span-1 w-full relative">
                <Search className="w-4 h-4 md:w-4 md:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11358B] text-sm md:text-xs font-bold text-[#11358B] transition-all shadow-sm"
                />
              </div>
              <div className="col-span-1 w-full relative">
                <Smartphone className="w-4 h-4 md:w-4 md:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by phone..."
                  value={phoneFilter}
                  onChange={(e) => setPhoneFilter(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11358B] text-sm md:text-xs font-bold text-[#11358B] transition-all shadow-sm"
                />
              </div>
              <div className="col-span-2 md:col-span-1 w-full md:w-auto relative shrink-0">
                <Coins className="w-4 h-4 md:w-4 md:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  placeholder="Min points..."
                  value={minPointsFilter}
                  onChange={(e) => setMinPointsFilter(e.target.value)}
                  className="w-full md:w-32 min-h-[44px] pl-9 pr-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#11358B] text-sm md:text-xs font-bold text-[#11358B] transition-all shadow-sm"
                />
              </div>
            </div>

            {/* 2. Desktop Header */}
            <div className="hidden md:grid grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)] border-b border-gray-300 text-[#11358B] text-xs font-bold uppercase tracking-widest bg-[#F8FAFC] divide-x divide-gray-300">
              <div className="px-6 py-4">Name</div>
              <div className="px-6 py-4">Mobile Number</div>
              <div className="px-6 py-4">Total Points</div>
              <div className="px-6 py-4 text-right">Action</div>
            </div>

            {/* 3. The Grid Body */}
            <div className="flex flex-col divide-y divide-gray-300 bg-white">
              {filteredBeneficiaries.map((b, idx) => (
                <div 
                  key={idx} 
                  onClick={() => fetchUserHistory(b.phone)}
                  className="transition-colors flex flex-col md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)] md:items-stretch md:divide-x md:divide-gray-300 hover:bg-[#F8FAFC]/60 cursor-pointer relative"
                >
                  {/* Name & Points (Top on Mobile) */}
                  <div className="flex items-start justify-between p-4 md:px-6 md:py-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#EFF0F4] text-[#11358B] flex items-center justify-center shrink-0 shadow-sm font-black text-lg">
                        {b.name ? b.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="flex flex-col">
                        <p className="font-extrabold text-[#11358B] text-sm md:text-base leading-tight">{b.name}</p>
                        <p className="md:hidden font-mono text-gray-500 text-xs mt-0.5">{b.phone}</p>
                      </div>
                    </div>
                    {/* Points Mobile Inline */}
                    <div className="md:hidden flex flex-col items-end shrink-0">
                      <span className="font-black text-lg text-[#6192FC]">{b.points} <span className="text-xs font-bold text-gray-400 ml-0.5 uppercase">Pts</span></span>
                    </div>
                  </div>

                  {/* Phone (Desktop) */}
                  <div className="hidden md:flex items-center px-6 py-4 text-gray-500 font-mono text-sm">
                    {b.phone}
                  </div>

                  {/* Points (Desktop) */}
                  <div className="hidden md:flex items-center px-6 py-4 font-black text-lg text-[#6192FC]">
                    {b.points}
                  </div>

                  {/* Action */}
                  <div className="px-4 py-3 md:px-6 md:py-4 flex justify-end md:items-center bg-white md:bg-transparent border-t border-gray-200 md:border-0">
                    {confirmZeroOutPhone === b.phone ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); executeResetPoints(b.phone, b.name); }}
                        className="min-h-[44px] px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all active:scale-95 text-sm md:text-xs font-bold flex items-center justify-center gap-2 cursor-pointer md:w-auto shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        Confirm Zero Out
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmZeroOutPhone(b.phone); }}
                        className="min-h-[44px] px-5 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#EF4444] rounded-xl transition-all active:scale-95 text-sm md:text-xs font-bold flex items-center justify-center gap-2 cursor-pointer md:w-auto"
                      >
                        <UserMinus className="w-4 h-4 md:w-3.5 md:h-3.5" />
                        Zero Out
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
          <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => setActiveView('ledger')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-xl transition-all active:scale-95 cursor-pointer text-brand-charcoal shrink-0"
              >
                <ArrowLeft className="w-6 h-6 md:w-5 md:h-5" />
              </button>
              <div className="w-12 h-12 rounded-full bg-brand-blue-50 border-2 border-brand-blue-50 flex items-center justify-center text-lg font-bold text-brand-blue shrink-0">
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-bold text-brand-charcoal tracking-tight truncate">{selectedUser.name}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-charcoal mt-1">
                  <span className="flex items-center gap-1"><Smartphone className="w-4 h-4" /> {selectedUser.phone}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="font-semibold text-brand-blue">Current Balance: {selectedUser.points} pts</span>
                </div>
              </div>
            </div>
            {confirmZeroOutPhone === selectedUser.phone ? (
              <button
                onClick={(e) => { e.stopPropagation(); executeResetPoints(selectedUser.phone, selectedUser.name); }}
                className="sm:ml-auto min-h-[44px] px-6 bg-red-600 hover:bg-red-700 text-white font-bold text-sm md:text-xs rounded-xl transition-all active:scale-95 cursor-pointer border border-red-700 flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm"
              >
                <CheckCircle className="w-5 h-5 md:w-4 md:h-4" />
                Confirm Zero Out
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmZeroOutPhone(selectedUser.phone); }}
                className="sm:ml-auto min-h-[44px] px-6 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm md:text-xs rounded-xl transition-all active:scale-95 cursor-pointer border border-red-200/50 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <UserMinus className="w-5 h-5 md:w-4 md:h-4" />
                Zero Out Balance
              </button>
            )}
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
              <div className="flex-1 w-full bg-white md:rounded-[24px] border border-gray-200 overflow-hidden shadow-sm">
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)] border-b border-gray-300 text-[#11358B] text-xs font-bold uppercase tracking-widest bg-[#F8FAFC] divide-x divide-gray-300 rounded-t-[24px]">
                  <div className="px-6 py-4">Transaction</div>
                  <div className="px-6 py-4">Date</div>
                  <div className="px-6 py-4 text-right">Points</div>
                  <div className="px-6 py-4 text-right">Status</div>
                </div>

                {/* Grid Body */}
                <div className="flex flex-col divide-y divide-gray-300 bg-white">
                  {userHistory.map((item, idx) => (
                    <div 
                      key={item.uid || idx} 
                      className={`transition-colors flex flex-col md:grid md:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)] md:items-stretch md:divide-x md:divide-gray-300 ${item.zeroedOut ? 'bg-red-50/10 hover:bg-red-50/30' : 'hover:bg-[#F8FAFC]/60'}`}
                    >
                      {/* Top Row on Mobile, Column 1 on Desktop */}
                      <div className="flex items-start justify-between md:justify-start w-full md:w-auto p-4 md:px-6 md:py-4 md:items-center">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] bg-[#11358B] text-white flex items-center justify-center shrink-0 shadow-sm">
                            <QrCode className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <div className="flex flex-col">
                            <p className="font-extrabold text-[#11358B] text-sm md:text-base leading-tight">LOT {String(item.lotNumber || 0).padStart(3, '0')}</p>
                            <p className="font-mono text-gray-500 text-xs mt-0.5">{item.uid ? item.uid.slice(0, 8) + '...' : 'UNKNOWN'}</p>
                          </div>
                        </div>
                        
                        {/* Points + Status (Mobile Top Right) */}
                        <div className="flex flex-col items-end md:hidden shrink-0">
                          <span className={`font-black text-lg ${item.zeroedOut ? 'text-gray-400 line-through' : 'text-[#6192FC]'}`}>
                            +{item.points}
                          </span>
                          {item.zeroedOut ? (
                             <span className="mt-1 text-[10px] font-bold text-rose-500 uppercase tracking-wider">Withdrawn</span>
                          ) : (
                             <span className="mt-1 text-[10px] font-bold text-[#6B8500] uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Active</span>
                          )}
                        </div>
                      </div>

                      {/* Middle Row on Mobile, Column 2 on Desktop */}
                      <div className="text-[#11358B] flex md:flex-col items-center md:items-start justify-between md:justify-center text-sm ml-[52px] md:ml-0 mt-1 md:mt-0 px-4 pb-4 md:px-6 md:py-4">
                        <span className="font-bold md:font-extrabold text-gray-700 md:text-[#11358B]">{item.claimedAt ? new Date(item.claimedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                        <span className="text-gray-500 text-xs font-medium flex items-center gap-1.5 md:mt-1"><Clock className="w-3.5 h-3.5" /> {item.claimedAt ? new Date(item.claimedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>

                      {/* Desktop Columns 3 & 4 */}
                      <div className="hidden md:flex justify-end items-center font-black text-lg px-6 py-4">
                        <span className={item.zeroedOut ? 'text-gray-400 line-through' : 'text-[#6192FC]'}>
                          +{item.points}
                        </span>
                      </div>
                      <div className="hidden md:flex justify-end items-center px-6 py-4">
                        {item.zeroedOut ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                            Withdrawn
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#f4fce0] text-[#11358B] border border-[#e5f5b5]">
                            <CheckCircle className="w-4 h-4" />
                            Active
                          </span>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
      )}

      </AnimatePresence>
      </div>





    </div>
  );
}
