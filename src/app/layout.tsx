import type { Metadata, Viewport } from "next"
import { Inter, Noto_Sans_Ethiopic, Noto_Sans_Arabic } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { InstallAppPrompt } from "@/components/InstallAppPrompt"
import { I18nProvider } from "@/i18n/I18nProvider"
import { LOCALE_STORAGE_KEY } from "@/i18n/config"
import { ThemeProvider, THEME_STORAGE_KEY } from "@/components/theme/ThemeProvider"
import { ThemedToaster } from "@/components/theme/ThemeToggle"

// Latin (English, Afaan Oromoo, Somali), Ethiopic (Amharic) and Arabic.
// Script fonts are not preloaded: the browser fetches them only when a page
// actually contains those characters (unicode-range).
const latin = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-latin", display: "swap" })
const ethiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ethiopic",
  display: "swap",
  preload: false,
})
const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
  preload: false,
})

export const metadata: Metadata = {
  title: {
    default: "MMS — Madrasa Management System",
    template: "%s | MMS",
  },
  // No description on purpose: it is what link previews (Telegram, WhatsApp)
  // show under the title when sharing the URL.
  applicationName: "MMS",
  keywords: ["madrasa", "medresah", "ustaz", "attendance", "students", "management"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/favicon-64.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "MMS",
    statusBarStyle: "default",
  },
  // No openGraph.description on purpose: link previews (Telegram, WhatsApp,
  // etc.) would otherwise show this text when sharing the URL.
  openGraph: {
    title: "MMS — Madrasa Management System",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1117" },
  ],
  width: "device-width",
  initialScale: 1,
}

// Applies the saved language + text direction and the light/dark theme before
// first paint, so Arabic users never see a left-to-right flash and night-mode
// users never see a white flash.
const bootScript = `try{var d=document.documentElement;var l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});if(l){d.lang=l;d.dir=l==='ar'?'rtl':'ltr'}var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark')}catch(e){}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${latin.variable} ${ethiopic.variable} ${arabic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              {children}
              <InstallAppPrompt />
            </AuthProvider>
            <ThemedToaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
