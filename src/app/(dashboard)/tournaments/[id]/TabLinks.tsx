'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function TabLinks({ tabs }: { tabs: { name: string; path: string }[] }) {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 p-1 rounded-xl overflow-x-auto max-w-full no-scrollbar">
      {tabs.map(tab => {
        // Match exact or prefix for subpages (except the overview root)
        const isActive = tab.path === `/tournaments/${tab.path.split('/')[2]}` 
          ? pathname === tab.path 
          : pathname.startsWith(tab.path)

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`px-3.5 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap shrink-0 ${
              isActive
                ? 'bg-gradient-to-r from-neon-cyan to-blue-500 text-black shadow-[0_0_15px_rgba(0,245,255,0.25)] font-black'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.name}
          </Link>
        )
      })}
    </div>
  )
}
