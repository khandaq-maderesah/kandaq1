import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"
import { InstallAppPrompt } from "@/components/InstallAppPrompt"

export const metadata: Metadata = {
  title: {
    default: "Ansar Madresah",
    template: "%s | Ansar Madresah",
  },
  description: "Madresah attendance management system for Ansar Madresah.",
  applicationName: "Ansar Madresah",
  keywords: ["attendance", "school", "students", "teachers", "madresah", "management"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/image/logo2.jpg",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Ansar Madresah",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Ansar Madresah",
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