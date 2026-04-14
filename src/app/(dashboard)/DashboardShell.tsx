'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'
import { motion, AnimatePresence } from 'framer-motion'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [])

  const NavLinks = () => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      <Link
        href="/tournaments"
        onClick={() => setDrawerOpen(false)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h18M3 12h18M3 17h18" />
        </svg>
        Mis Torneos
      </Link>
    </nav>
  )

  const SidebarFooter = () => (
    <div className="px-3 py-4 border-t border-white/5">
      <form action={signOut}>
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </form>
      <div className="mt-6 text-center opacity-30 pointer-events-none select-none">
        <span className="text-[9px] uppercase tracking-widest block font-orbitron">Powered by</span>
        <span className="text-xs font-bold uppercase tracking-wider mt-0.5 block font-orbitron text-neon-cyan">GonzalezLabs</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-dark-card border-r border-white/5 flex-col">
        <div className="px-6 py-5 border-b border-white/5">
          <Link href="/tournaments">
            <span className="font-orbitron text-sm font-bold tracking-widest text-neon-cyan uppercase">KRO<span className="text-white">NIX</span></span>
            <span className="block font-orbitron text-[10px] tracking-[0.25em] text-white/30 uppercase mt-0.5">by GonzalezLabs</span>
          </Link>
        </div>
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-dark-card/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 py-3">
        <Link href="/tournaments">
          <span className="font-orbitron text-sm font-bold tracking-widest text-neon-cyan uppercase">Tournament</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-dark-card border-r border-white/5 flex flex-col"
            >
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <Link href="/tournaments" onClick={() => setDrawerOpen(false)}>
                  <span className="font-orbitron text-sm font-bold tracking-widest text-neon-cyan uppercase">Tournament</span>
                  <span className="block font-orbitron text-[10px] tracking-[0.25em] text-white/30 uppercase mt-0.5">Platform</span>
                </Link>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <NavLinks />
              <SidebarFooter />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content — padding top on mobile for the fixed header */}
      <main className="flex-1 overflow-auto pt-[52px] lg:pt-0">
        {children}
      </main>
    </div>
  )
}
