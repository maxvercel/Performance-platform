import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  themeColor: '#09090b',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '9toFit',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
