import { redirect } from 'next/navigation'
import { isAdmin, isSuperAdmin, getProfile } from '@/lib/actions/auth-helpers'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const allowed = await isAdmin()
  if (!allowed) {
    redirect('/tournaments')
  }

  const isSuperAdminUser = await isSuperAdmin()
  const profile = await getProfile()

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Admin Navbar */}
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 h-14 bg-[#121219]/95 backdrop-blur-md border-b border-white/5 items-center px-6 z-50 gap-6">
        <Link href="/admin" className="font-black tracking-tighter text-lg mr-2 shrink-0">
          KRONIX<span className="text-neon-cyan">ADMIN</span>
        </Link>

        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-white/50 overflow-x-auto">
          <Link href="/admin/subscriptions" className="hover:text-neon-cyan transition-colors whitespace-nowrap">Suscripciones</Link>
          <Link href="/admin/tickets" className="hover:text-neon-cyan transition-colors whitespace-nowrap">Tickets</Link>
          <Link href="/admin/analytics" className="hover:text-neon-cyan transition-colors whitespace-nowrap">Analíticas</Link>
          <Link href="/admin/ads" className="hover:text-neon-cyan transition-colors whitespace-nowrap">Publicidad</Link>
          {isSuperAdminUser && (
            <>
              <Link href="/admin/users" className="hover:text-yellow-300 transition-colors whitespace-nowrap text-yellow-400/70">Usuarios</Link>
              <Link href="/admin/revenue" className="hover:text-yellow-300 transition-colors whitespace-nowrap text-yellow-400/70">Ingresos</Link>
              <Link href="/admin/settings" className="hover:text-yellow-300 transition-colors whitespace-nowrap text-yellow-400/70">Config. Inicio</Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-4 shrink-0">
          <span className="hidden sm:flex items-center gap-2 text-xs text-white/30">
            <span className={`w-2 h-2 rounded-full ${
              profile?.role === 'SUPER_ADMIN' ? 'bg-yellow-400' : 'bg-orange-400'
            }`} />
            {profile?.username || 'Admin'}
          </span>
          <Link href="/tournaments" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
            ← App
          </Link>
        </div>
      </nav>

      <main className="pt-20 pb-12 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
