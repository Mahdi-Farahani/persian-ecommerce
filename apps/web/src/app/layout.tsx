import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type React from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { CartProvider } from '@/components/cart/cart-provider';
import { ToastProvider } from '@/components/ui/toast';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { WishlistProvider } from '@/components/wishlist/wishlist-provider';
import { t } from '@/i18n';
import { getCurrentUser } from '@/lib/auth/server';
import { getCart } from '@/lib/cart/server';
import { env } from '@/lib/env';
import './globals.css';

const vazirmatn = localFont({
  src: '../assets/fonts/Vazirmatn-Variable.woff2',
  variable: '--font-vazirmatn',
  weight: '100 900',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: t.app.name,
    template: `%s | ${t.app.name}`,
  },
  description: t.app.description,
  applicationName: t.app.name,
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: t.app.name,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1b5cf5',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, cart] = await Promise.all([getCurrentUser(), getCart()]);
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AuthProvider initialUser={user}>
          <CartProvider initialCart={cart}>
            <WishlistProvider>
              <ToastProvider>
                <a href="#main-content" className="skip-link">
                  {t.nav.skipToContent}
                </a>
                <SiteHeader />
                <main id="main-content" className="flex-1">
                  {children}
                </main>
                <SiteFooter />
              </ToastProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
