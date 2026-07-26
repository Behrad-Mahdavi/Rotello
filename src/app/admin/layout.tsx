import Image from 'next/image'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" dir="rtl">
      <aside className="flex w-56 flex-col bg-surface">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface shadow-sm overflow-hidden">
            <Image src="/logog.png" alt="رکاد" width={24} height={24} className="object-contain" />
          </div>
          <span className="text-sm font-bold text-default">پنل مدیریت</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          <Link href="/admin/members"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-subtle transition-all hover:bg-admin-subtle hover:text-admin">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            مدیریت اعضا
          </Link>
          <Link href="/admin/projects"
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
      <main className="flex-1 overflow-auto bg-canvas p-6">{children}</main>
    </div>
  )
}
