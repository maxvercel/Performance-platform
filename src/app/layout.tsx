import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { ToastProvider } from "@/components/ui/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: '9toFit — Jouw Fitness Platform',
    template: '%s | 9toFit',
  },
  description: 'Track je workouts, behaal PRs, en bereik je fitnessdoelen met persoonlijke coaching.',
  keywords: ['fitness', 'workout tracker', 'personal records', 'coaching', '9toFit'],
  authors: [{ name: '9toFit' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
  themeColor: '#f97316',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '9toFit',
  },
  metadataBase: new URL('https://app.9tofit.nl'),
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192' },
      { url: '/icon-512.png', sizes: '512x512' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="9toFit" />
        <meta name="theme-color" content="#f97316" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#f97316" media="(prefers-color-scheme: dark)" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
