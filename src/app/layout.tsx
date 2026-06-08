import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PEDV — Sistema Jurídico',
  description: 'Sistema de gestão para escritório de advocacia',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="h-full" suppressHydrationWarning>
      <body className="h-full antialiased" suppressHydrationWarning>{children}</body>
    </html>
  )
}
