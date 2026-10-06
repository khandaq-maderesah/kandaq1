import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { InstallAppPrompt } from "@/components/InstallAppPrompt"

export const metadata: Metadata = {
  title: {
    default: "Khandaq Madresah",
    template: "%s | Khandaq Madresah",
  },
  description: "Madresah attendance management system for Khandaq Madresah.",
  applicationName: "Khandaq Madresah",
  keywords: ["attendance", "school", "students", "teachers", "madresah", "management"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/image/khandaq-logo.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Khandaq Madresah",
    statusBarStyle: "default",
  },
  // No openGraph.description on purpose: link previews (Telegram, WhatsApp,
  // etc.) would otherwise show this text when sharing the URL.
  openGraph: {
    title: "Khandaq Madresah",
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