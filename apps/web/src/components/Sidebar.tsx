import Link from 'next/link'
import { Role } from '@metis/types'
import LogoutButton from './LogoutButton'

const navItems: Record<Role, { label: string; href: string }[]> = {
  STUDENT: [
    { label: 'Dashboard', href: '/student/dashboard' },
    { label: 'My Courses', href: '/courses' },
    { label: 'Notifications', href: '/notifications' },
  ],
  TEACHER: [
    { label: 'Dashboard', href: '/teacher/dashboard' },
    { label: 'My Courses', href: '/teacher/courses' },
    { label: 'Create Course', href: '/teacher/courses/new' },
  ],
}

export default function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white px-4 py-6">
      <Link href="/" className="text-xl font-bold text-accent mb-8">
        Metis
      </Link>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems[role].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-accent-light hover:text-accent transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <Link
        href="/settings"
        className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
      >
        Account settings
      </Link>
      <LogoutButton />
    </aside>
  )
}
