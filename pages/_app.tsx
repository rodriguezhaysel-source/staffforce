import type { AppProps } from 'next/app'
import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <>
      <Head>
        <meta name="application-name" content="StaffForce" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="StaffForce" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0A6EBD" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
