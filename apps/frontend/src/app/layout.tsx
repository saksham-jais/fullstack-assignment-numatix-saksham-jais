import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthInitializer } from '@/components/AuthInitializer';
import MarketProvider from '@/components/MarketProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Numatix - Real-Time Trading Platform (Testnet)',
  description: 'Fullstack assignment - Binance Testnet trading UI with real-time updates',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className={`${inter.className} antialiased min-h-screen`}>
        <AuthInitializer />
        <MarketProvider>
          {children}
        </MarketProvider>
      </body>
    </html>
  );
}