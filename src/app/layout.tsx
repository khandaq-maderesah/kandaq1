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
    icon: "/image/logo2.jpg",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Khandaq Madresah",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Khandaq Madresah",
    description: "Track attendance, manage students and keep parents informed.",
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