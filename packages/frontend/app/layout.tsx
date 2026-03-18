/**
 * @file Root layout for the InvoiceScan Next.js application.
 *
 * Wraps every page with:
 * - Geist / Geist Mono variable fonts
 * - Dark-mode HTML root
 * - Global providers (React Query, AuthContext)
 * - Sonner toast notifications
 * - Vercel Analytics (no-op in non-Vercel environments)
 */
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ToasterClient } from '@/components/toaster-client'
import { Providers } from './providers'
import './globals.css'

const geist = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist-sans',
});
const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'InvoiceScan - Invoice Automation Platform',
  description: 'Automated invoice processing and approval workflow',
  icons: {
    icon: [
      {
        url: '/INVOICESCANLOGO2.png',
        type: 'image/png',
      },
    ],
    apple: '/INVOICESCANLOGO2.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#09090B',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-[#09090B] text-zinc-50`}>
        <Providers>
          {children}
          <ToasterClient />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
