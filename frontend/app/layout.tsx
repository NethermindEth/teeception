import type { Metadata } from 'next'
import { IBM_Plex_Mono, DM_Sans } from 'next/font/google'
import './globals.css'

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '#TEECEPTION',
  description: 'Teeception: The Prompt Hacking Arena',
  icons: {
    icon: '/icons/shield.svg',
    shortcut: '/icons/shield.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${ibmPlexMono.variable} ${dmSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
