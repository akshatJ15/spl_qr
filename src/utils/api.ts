/**
 * Resolves API endpoints dynamically based on the execution environment.
 * - In Capacitor mobile apps (Android/iOS WebView): routes to the remote backend (Render/custom domain).
 * - In web browsers: routes to relative '/api' endpoints to communicate directly with the local Express server.
 */

import { Capacitor } from '@capacitor/core';

export const getApiBaseUrl = (): string => {
  // 1. Detect if running inside a Capacitor / WebView container (native mobile)
  const isCapacitor = 
    typeof window !== 'undefined' && 
    (window.location.protocol === 'capacitor:' || 
     window.location.protocol === 'file:' || 
     Capacitor.isNativePlatform());

  if (isCapacitor) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      return envUrl.replace(/\/+$/, '');
    }
    // Default fallback remote production backend for the mobile app
    return 'https://spl-qr-rewards.onrender.com';
  }

  // 2. In standard web browsers, use relative URLs so requests hit the local Express backend
  return '';
};

export const apiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${cleanPath}` : cleanPath;
};
