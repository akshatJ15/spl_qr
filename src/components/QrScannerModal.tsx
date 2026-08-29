import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { Camera, X, Upload, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (token: string) => void;
}

export const extractTokenFromScannedData = (scannedText: string): string => {
  if (!scannedText) return '';
  const trimmed = scannedText.trim();

  // 1. If scanned text is a full URL with query param ?token=XYZ
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const urlToken = url.searchParams.get('token');
      if (urlToken) return urlToken.trim();

      // Check path parts (e.g., /claim/XYZ)
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== 'claim') {
          return lastPart.trim();
        }
      }
    }
  } catch {
    // If not a valid URL, fallback to raw string
  }

  // 2. Direct string (UID format or raw token)
  return trimmed;
};

export default function QrScannerModal({ isOpen, onClose, onScanSuccess }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const stopCamera = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanningActive(false);
  }, []);

  const handleScannedResult = useCallback((rawData: string) => {
    if (isProcessing) return;
    const token = extractTokenFromScannedData(rawData);
    if (!token) {
      setErrorMessage('Could not recognize token format in this QR code.');
      return;
    }

    setIsProcessing(true);
    stopCamera();

    // Haptic vibration feedback on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(100);
      } catch {
        // Ignore haptics failure on restricted devices
      }
    }

    onScanSuccess(token);
  }, [isProcessing, onScanSuccess, stopCamera]);

  const requestNativeCameraPermission = useCallback(async () => {
    if (typeof window === 'undefined') return true;

    const isNativeCapacitor =
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

    if (!isNativeCapacitor) return true;

    try {
      const status = await CapacitorCamera.checkPermissions();
      if (status.camera === 'granted') return true;

      const request = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
      return request.camera === 'granted';
    } catch (error) {
      console.warn('Native camera permission request failed:', error);
      return false;
    }
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      handleScannedResult(code.data);
      return;
    }

    animationFrameIdRef.current = requestAnimationFrame(scanFrame);
  }, [handleScannedResult]);

  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setHasCameraPermission(null);
    stopCamera();

    try {
      const nativePermissionGranted = await requestNativeCameraPermission();
      if (!nativePermissionGranted) {
        setHasCameraPermission(false);
        setErrorMessage('Camera permission was denied on this device. Please allow access to scan the QR code.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera streaming is not supported on this browser or platform.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setHasCameraPermission(true);
      setIsScanningActive(true);
      animationFrameIdRef.current = requestAnimationFrame(scanFrame);
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setHasCameraPermission(false);
      const message = err instanceof Error ? err.message : 'Camera access denied or unavailable.';
      setErrorMessage(message);
    }
  }, [requestNativeCameraPermission, scanFrame, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Fallback: Handle Image File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleScannedResult(code.data);
        } else {
          setErrorMessage('No valid QR code found in uploaded image. Please try another photo.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base leading-tight">Scan Incentive QR</h3>
              <p className="text-xs text-slate-400">Point camera at physical token QR</p>
            </div>
          </div>
          <button
            id="close-scanner-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            aria-label="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Camera Viewport */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewfinder Target Guide */}
          {hasCameraPermission && isScanningActive && !isProcessing && (
            <div className="relative z-10 w-64 h-64 border-2 border-blue-500/80 rounded-2xl flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 border-4 border-white/20 rounded-2xl animate-pulse"></div>
              {/* Scanning Red Laser Line */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-bounce shadow-md shadow-blue-500/50"></div>
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
            </div>
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-white font-medium text-sm">Validating & claiming token...</p>
            </div>
          )}

          {/* Error / Fallback State */}
          {hasCameraPermission === false && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl mb-3">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-white font-semibold text-sm mb-1">Camera Access Restricted</h4>
              <p className="text-xs text-slate-400 mb-4 max-w-xs leading-relaxed">
                {errorMessage || 'Please allow camera permissions or upload a QR image from your gallery.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Controls / Upload Fallback */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3">
          {errorMessage && hasCameraPermission !== false && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              id="upload-qr-file-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer border border-slate-700"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Image QR</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
