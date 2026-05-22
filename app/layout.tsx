import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from './components/SessionProvider'
import SmoothScroll from './components/SmoothScroll'

export const metadata: Metadata = {
  title: 'GitTime — Commit Timeline Generator',
  description: 'Transform your project into a realistic Git commit history across multiple days.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="noise-bg grid-bg antialiased">
        <SmoothScroll>
          <AuthProvider>
            {children}
          </AuthProvider>
        </SmoothScroll>
      </body>
    </html>
  )
}
