import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={`${plusJakarta.variable} ${ibmPlexMono.variable}`}>
      <Component {...pageProps} />
    </main>
  )
}
