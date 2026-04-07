import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-dark-card border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <Link href="/tournaments">
            <span className="font-orbitron text-sm font-bold tracking-widest text-neon-cyan uppercase">
              Tournament
            </span>
            <span className="block font-orbitron text-[10px] tracking-[0.25em] text-white/30 uppercase mt-0.5">
              Platform
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/tournaments"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7h18M3 12h18M3 17h18"
              />
            </svg>
            Mis Torneos
          </Link>
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-white/5">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Cerrar sesión
            </button>
          </form>

          {/* Sello de Marca */}
          <div className="mt-8 text-center opacity-30 pointer-events-none select-none">
            <span className="text-[9px] uppercase tracking-widest block font-orbitron">Powered by</span>
            <span className="text-xs font-bold uppercase tracking-wider mt-0.5 block font-orbitron">Gonzalez Labs</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
