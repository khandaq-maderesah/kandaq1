import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ClipboardCheck, PhoneCall, BarChart3, ArrowRight } from 'lucide-react'
import NeonWaveBackground from '@/components/NeonWaveBackground'

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
    color: 'bg-amber-500',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden text-white">
        <NeonWaveBackground />

        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <Image
              src="/image/khandaq-logo.png"
              alt="Khendeq Medresah logo"
              width={200}
              height={200}
              priority
              className="h-auto w-40 rounded-full shadow-2xl ring-1 ring-white/25 md:w-52"
            />
          </div>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            Khendeq Medresah <span className="text-green-200">Students Management System</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-green-100 md:text-xl">
            Track attendance, manage students, and keep parents informed —
            all in one beautiful place.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="group btn inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 font-semibold text-green-700 shadow-lg transition hover:bg-green-50"
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

      {/* Everything you need — modern gradient background */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 right-0 h-64 w-64 rounded-full bg-purple-300/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
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
                className="card-bounce h-full rounded-2xl bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 p-[2px] shadow-[0_0_24px_rgba(168,85,247,0.35)] transition-shadow hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
              >
                <div className="h-full rounded-[14px] bg-white p-8">
                  <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.color} text-white shadow-md`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-gray-600">{f.description}</p>
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </section>

      <footer className="bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-800 py-8 text-center text-sm text-purple-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        © {new Date().getFullYear()} Khendeq Medresah Students Management System. All rights reserved.
      </footer>
    </main>
  )
}