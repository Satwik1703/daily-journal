import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/bottom-nav";
import { SyncBootstrap } from "@/components/sync-bootstrap";
import { DeviceNicknameDialog } from "@/components/device-nickname-dialog";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Habit Log",
  description: "Daily journal, habits, and gym tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Habit Log",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1f1f",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
            {children}
          </main>
          <BottomNav />
          <SyncBootstrap />
          <DeviceNicknameDialog />
          <Toaster position="top-center" richColors />
        </ThemeProvider>
        <Script id="register-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
  // Register the SW only on HTTPS production deploys. On localhost (dev),
  // proactively unregister any stale SW so Turbopack-rebuilt chunks aren't
  // served from cache. Cached _next/static chunks from a previous session
  // can make the layout look unstyled ("bottom nav as a list").
  const isProd = location.protocol === 'https:' && location.hostname !== 'localhost';
  window.addEventListener('load', () => {
    if (isProd) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister().catch(() => {});
      }).catch(() => {});
      if (window.caches) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  });
}`}
        </Script>
      </body>
    </html>
  );
}
