'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function TabLinks({ tabs }: { tabs: { name: string; path: string }[] }) {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (el) {
      setCanScrollLeft(el.scrollLeft > 5)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [tabs])

  // Scroll active tab into view smoothly
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      const activeBtn = el.querySelector('[data-active="true"]') as HTMLElement
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
      setTimeout(checkScroll, 300)
    }
  }, [pathname])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (el) {
      const amount = direction === 'left' ? -200 : 200
      el.scrollBy({ left: amount, behavior: 'smooth' })
      setTimeout(checkScroll, 300)
    }
  }

  return (
    <div className="relative flex items-center w-full max-w-full group">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Desplazar a la izquierda"
          className="absolute -left-3 z-20 p-1.5 rounded-full bg-black/90 border border-white/20 text-white shadow-xl hover:bg-neon-cyan hover:text-black transition-all"
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Tabs Horizontal Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl overflow-x-auto max-w-full scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        {tabs.map((tab) => {
          // Match exact or prefix for subpages (except the overview root)
          const isOverview = tab.path === `/tournaments/${tab.path.split('/')[2]}`
          const isActive = isOverview
            ? pathname === tab.path
            : pathname.startsWith(tab.path)

          return (
            <Link
              key={tab.path}
              href={tab.path}
              data-active={isActive}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-gradient-to-r from-neon-cyan to-blue-500 text-black shadow-[0_0_15px_rgba(0,245,255,0.3)] font-black'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.name}
            </Link>
          )
        })}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Desplazar a la derecha"
          className="absolute -right-3 z-20 p-1.5 rounded-full bg-black/90 border border-white/20 text-white shadow-xl hover:bg-neon-cyan hover:text-black transition-all"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}
