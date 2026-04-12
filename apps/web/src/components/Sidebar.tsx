'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, RotateCcw, Bell, Settings } from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { Role } from '@metis/types'
import LogoutButton from './LogoutButton'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<LucideProps>
}

const navItems: Record<Role, NavItem[]> = {
  STUDENT: [
    { label: 'Dashboard',     href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Courses',    href: '/student/courses',   icon: BookOpen },
    { label: 'Review',        href: '/student/review',    icon: RotateCcw },
    { label: 'Notifications', href: '/notifications',     icon: Bell },
  ],
  TEACHER: [
    { label: 'Dashboard',  href: '/teacher/dashboard', icon: LayoutDashboard },
    { label: 'My Courses', href: '/teacher/courses',   icon: BookOpen },
  ],
}

function initials(name: string): string {
  if (!name.trim()) return '?'
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Sidebar({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const homeHref = role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard'

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white px-3 py-6">
      {/* Logo */}
      <Link href={homeHref} className="flex items-center gap-2 px-3 mb-8">
        <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
        <span className="text-base font-bold text-gray-900">Umenti</span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems[role].map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'border border-teal-600 text-teal-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} className={active ? 'text-teal-600' : 'text-gray-400'} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Settings size={16} className="text-gray-400" />
          Account settings
        </Link>

        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold leading-none">{initials(userName)}</span>
          </div>
          <span className="text-xs text-gray-500 truncate">{userName.split(' ')[0] || '—'}</span>
        </div>

        <LogoutButton />
      </div>
    </aside>
  )
}
