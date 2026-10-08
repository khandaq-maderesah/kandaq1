import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { InstallAppPrompt } from "@/components/InstallAppPrompt"

export const metadata: Metadata = {
  title: {
    default: "Khendeq Medresah",
    template: "%s | Khendeq Medresah",
  },
  // No description on purpose: it is what link previews (Telegram, WhatsApp)
  // show under the title when sharing the URL.
  applicationName: "Khendeq Medresah",
  keywords: ["attendance", "school", "students", "teachers", "madresah", "management"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/image/khandaq-logo.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Khendeq Medresah",
    statusBarStyle: "default",
  },
  // No openGraph.description on purpose: link previews (Telegram, WhatsApp,
  // etc.) would otherwise show this text when sharing the URL.
  openGraph: {
    title: "Khendeq Medresah",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AuthProvider>
          {children}
          <InstallAppPrompt />
        </AuthProvider>
      </body>
    </html>
  )
}