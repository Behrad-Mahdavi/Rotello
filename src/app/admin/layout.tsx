'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen" dir="rtl">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 right-0 z-50 flex w-56 flex-col bg-surface transition-transform lg:relative lg:z-0 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex h-14 items-center justify-between gap-2.5 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface shadow-sm overflow-hidden">
              <Image src="/logog.png" alt="رکاد" width={24} height={24} className="object-contain" />
            </div>
            <span className="text-sm font-bold text-default">پنل مدیریت</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-default lg:hidden">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          <Link href="/admin/members" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-subtle transition-all hover:bg-admin-subtle hover:text-admin">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            مدیریت اعضا
          </Link>
          <Link href="/admin/projects" onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-subtle transition-all hover:bg-admin-subtle hover:text-admin">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            پروژه‌ها
          </Link>
        </nav>

        <div className="p-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col bg-canvas">
        <header className="flex h-14 items-center gap-2 bg-surface px-4 shadow-sm lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-canvas">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface shadow-sm overflow-hidden">
            <Image src="/logog.png" alt="رکاد" width={20} height={20} className="object-contain" />
          </div>
          <span className="text-sm font-bold text-default">رکاد</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
