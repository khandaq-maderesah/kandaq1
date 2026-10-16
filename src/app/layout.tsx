import type { Metadata, Viewport } from "next"
import { Inter, Noto_Sans_Ethiopic, Noto_Sans_Arabic } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { InstallAppPrompt } from "@/components/InstallAppPrompt"
import { I18nProvider } from "@/i18n/I18nProvider"
import { LOCALE_STORAGE_KEY } from "@/i18n/config"

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
    default: "Khendeq",
    template: "%s | Khendeq",
  },
  // No description on purpose: it is what link previews (Telegram, WhatsApp)
  // show under the title when sharing the URL.
  applicationName: "Khendeq",
  keywords: ["attendance", "school", "students", "teachers", "madresah", "management"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/image/khandaq-logo.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Khendeq",
    statusBarStyle: "default",
  },
  // No openGraph.description on purpose: link previews (Telegram, WhatsApp,
  // etc.) would otherwise show this text when sharing the URL.
  openGraph: {
    title: "Khendeq",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#f5f6f8",
  width: "device-width",
  initialScale: 1,
}

// Applies the saved language + text direction before first paint, so Arabic
// users never see a left-to-right flash.
const localeBootScript = `try{var l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});if(l){document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr'}}catch(e){}`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${latin.variable} ${ethiopic.variable} ${arabic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeBootScript }} />
      </head>
      <body className="antialiased">
        <I18nProvider>
          <AuthProvider>
            {children}
            <InstallAppPrompt />
          </AuthProvider>
          <Toaster position="top-center" richColors closeButton />
        </I18nProvider>
      </body>
    </html>
  )
}
