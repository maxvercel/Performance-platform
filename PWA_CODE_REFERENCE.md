# PWA Code Reference - 9toFit

Quick code snippets for PWA implementation.

## 1. Service Worker Registration (in React component)

```typescript
// src/components/ServiceWorkerRegister.tsx
'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Workers are not supported');
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        console.log('[PWA] Service Worker registered:', registration);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (confirm('New version available. Update now?')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });

        // Check for updates every 60 seconds
        setInterval(() => registration.update(), 60000);
      } catch (error) {
        console.error('[PWA] Registration failed:', error);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', registerServiceWorker);
    } else {
      registerServiceWorker();
    }

    // Online/offline events
    window.addEventListener('online', () => console.log('[PWA] Online'));
    window.addEventListener('offline', () => console.log('[PWA] Offline'));
  }, []);

  return null;
}
```

## 2. Service Worker Caching Strategies

```javascript
// public/sw.js - Cache-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match('/offline.html'))
    })
  );
});
```

## 3. Layout.tsx PWA Configuration

```typescript
// src/app/layout.tsx
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  manifest: '/manifest.json',
  themeColor: '#f97316',
  metadataBase: new URL('https://9tofit.app'),
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '9toFit',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="9toFit" />
        <meta name="theme-color" content="#f97316" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
```

## 4. Next.js Configuration Headers

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  headers: async () => {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ]
  },
};
```

## 5. Web App Manifest

```json
{
  "name": "9toFit Performance Platform",
  "short_name": "9toFit",
  "description": "Jouw persoonlijke fitness coaching platform",
  "start_url": "/portal/dashboard",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#f97316",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ]
}
```

## 6. Browser API Usage

### Check if Service Worker is available
```javascript
if ('serviceWorker' in navigator) {
  console.log('Service Workers supported');
}
```

### Check online/offline status
```javascript
console.log(navigator.onLine); // true/false

window.addEventListener('online', () => {
  console.log('Back online');
});

window.addEventListener('offline', () => {
  console.log('Now offline');
});
```

### View service worker status
```javascript
navigator.serviceWorker.ready.then(() => {
  console.log('Service Worker is ready');
});
```

### Force update check
```javascript
navigator.serviceWorker.controller?.postMessage({
  type: 'CHECK_UPDATE'
});
```

### Access cache directly
```javascript
caches.keys().then((names) => {
  console.log('Available caches:', names);
  names.forEach((name) => {
    caches.open(name).then((cache) => {
      cache.keys().then((requests) => {
        console.log(`${name}:`, requests.map(r => r.url));
      });
    });
  });
});
```

## 7. Testing in DevTools

### Chrome DevTools
```
1. F12 to open DevTools
2. Application tab
3. Service Workers (left sidebar)
4. Check registration status
5. See console logs starting with [PWA]
6. View Cache Storage for cached files
7. Network tab → Offline checkbox to test offline
```

### Firefox DevTools
```
1. F12 to open DevTools
2. Storage tab
3. Service Workers (left)
4. View registered workers
5. View Cache Storage
6. Network tab → throttle to offline
```

## 8. Cache Version Management

### Increment version to clear cache
```javascript
// public/sw.js
const CACHE_VERSION = 'v2'; // Changed from v1
const CACHE_NAME = `9tofit-${CACHE_VERSION}`;
```

### Add files to pre-cache
```javascript
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icon.svg',
  '/api/workouts', // Add cached API responses
];
```

## 9. Custom Cache Strategy

### Implement custom fetch handler
```javascript
// For a specific route
if (url.pathname === '/portal/dashboard') {
  // Use network-first for dashboard
  event.respondWith(
    fetch(request)
      .then(response => {
        caches.open(CACHE_NAME).then(c => c.put(request, response.clone()));
        return response;
      })
      .catch(() => caches.match(request).then(r => r || errorResponse()))
  );
  return;
}
```

## 10. Offline Fallback Page

```html
<!-- public/offline.html -->
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>9toFit - Offline</title>
  <style>
    body {
      background: #09090b;
      color: #fff;
      font-family: system-ui;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    h1 { color: #f97316; }
    button {
      background: #f97316;
      color: #09090b;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      margin: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Je bent offline</h1>
    <p>Controleer je internetverbinding</p>
    <button onclick="location.reload()">Vernieuwen</button>
    <button onclick="window.location.href='/portal/dashboard'">Dashboard</button>
  </div>
</body>
</html>
```

## 11. Monitoring & Logging

### In service worker
```javascript
// Log every request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  console.log(`[SW] Fetching: ${request.url}`);
  // ... handle request
});

// Log cache operations
caches.open(CACHE_NAME).then((cache) => {
  console.log(`[SW] Opened cache: ${CACHE_NAME}`);
  cache.add(url).then(() => {
    console.log(`[SW] Cached: ${url}`);
  });
});
```

### In component
```typescript
// Log registration
console.log('[PWA] Service Worker registered');
console.log('[PWA] Cache version:', CACHE_VERSION);
console.log('[PWA] Scope:', registration.scope);

// Log updates
console.log('[PWA] Update found');
console.log('[PWA] New worker state:', newWorker.state);
```

## 12. Performance Optimization Tips

1. **Minimize service worker size**
   ```javascript
   // Remove debug logs in production
   const DEBUG = false;
   if (DEBUG) console.log('[SW]', message);
   ```

2. **Optimize cache patterns**
   ```javascript
   // Don't cache everything
   const CACHEABLE = ['text/html', 'application/json', 'image/'];
   ```

3. **Set expiration policies**
   ```javascript
   // Check cache age
   const isCacheExpired = (timestamp) => {
     return Date.now() - timestamp > 24 * 60 * 60 * 1000; // 24 hours
   };
   ```

4. **Use compression**
   - Enable gzip in Next.js
   - Minimize JSON in manifest
   - Compress icons

## 13. Error Handling

```typescript
try {
  await navigator.serviceWorker.register('/sw.js');
} catch (error) {
  if (error instanceof Error) {
    console.error('SW registration failed:', error.message);
    // Fallback behavior
  }
}
```

## 14. Security Best Practices

```javascript
// Verify origin in service worker
const isSecure = url.protocol === 'https:' || url.hostname === 'localhost';

// Don't cache sensitive data
const SENSITIVE_ROUTES = ['/api/auth', '/api/user/payment'];
if (SENSITIVE_ROUTES.some(r => url.pathname.startsWith(r))) {
  return; // Don't cache
}

// Always validate HTTPS in production
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.error('[PWA] HTTPS required for PWA in production');
}
```

## 15. Update Strategy

```typescript
// Check for updates on focus
window.addEventListener('focus', () => {
  registration.update();
});

// Check on page visibility
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    registration.update();
  }
});
```

---

For more information, see PWA_SETUP.md and PWA_IMPLEMENTATION_SUMMARY.md
