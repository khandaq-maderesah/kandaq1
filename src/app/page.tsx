import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ClipboardCheck, PhoneCall, BarChart3, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Home',
}

const features = [
  {
    icon: ClipboardCheck,
    title: 'Real-time Attendance',
    description: 'Teachers mark Present, Absent or Late in seconds. Admins see the full picture instantly.',
    color: 'bg-emerald-500',
  },
  {
    icon: PhoneCall,
    title: 'Parent Contact',
    description: 'Absent students are collected automatically with parent phone numbers for quick follow-up.',
    color: 'bg-sky-500',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Beautiful charts for grades, gender balance and daily attendance trends.',
    color: 'bg-purple-500',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 text-white">
        <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-indigo-400/20 blur-2xl" />

        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 h-20 w-20 overflow-hidden rounded-2xl shadow-lg ring-2 ring-white/40">
            <Image src="/image/khandaq-logo.png" alt="Khandaq Madresah logo" width={80} height={80} className="h-full w-full object-cover" />
          </div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            Khandaq Madresah <span className="text-indigo-200">Attendance</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-indigo-100 md:text-xl">
            Track attendance, manage students, and keep parents informed —
            all in one beautiful place.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
            >
              Login
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <svg className="absolute bottom-0 left-0 right-0 w-full text-slate-50" viewBox="0 0 1440 60" fill="currentColor" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" />
        </svg>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold text-gray-900">Everything you need</h2>
        <p className="mb-12 text-center text-lg text-gray-500">
          A complete attendance management solution for your madresah. From real-time attendance tracking to parent notifications and insightful reports, we&apos;ve got you covered.
        </p>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.color} text-white shadow-md`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">{f.title}</h3>
                <p className="text-gray-600">{f.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Khandaq Madresah Attendance. All rights reserved.
      </footer>
    </main>
  )
}