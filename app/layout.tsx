import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GitTime — Commit Timeline Generator',
  description: 'Transform your project into a realistic Git commit history across multiple days.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="noise-bg grid-bg antialiased">
        {children}
      </body>
    </html>
  )
}
