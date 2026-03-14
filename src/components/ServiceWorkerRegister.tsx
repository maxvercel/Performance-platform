'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Workers are not supported in this browser');
      return;
    }

    // Register the service worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        console.log('[PWA] Service Worker registered successfully:', registration);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is ready
              console.log('[PWA] New Service Worker available');

              // Notify user about update (optional)
              if (confirm('Er is een nieuwe versie van 9toFit beschikbaar. Nu updaten?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 3600000); // Check every hour

      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };

    // Delay registration slightly to let the page load first
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', registerServiceWorker);
    } else {
      registerServiceWorker();
    }

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[PWA] Device is online');
      // Optional: notify user
    };

    const handleOffline = () => {
      console.log('[PWA] Device is offline');
      // Optional: notify user
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}
