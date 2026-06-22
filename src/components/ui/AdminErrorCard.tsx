'use client'

import Link from 'next/link'

interface AdminErrorCardProps {
  section: string
  error?: any
}

export function AdminErrorCard({ section, error }: AdminErrorCardProps) {
  const errorMessage = typeof error === 'string' ? error : (error?.message || String(error || ''))
  const isServiceRoleError = errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY') || 
                             errorMessage.includes('service_role') || 
                             errorMessage.includes('service role') || 
                             errorMessage.includes('API key') ||
                             errorMessage.includes('service-role')

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-[#121219] border border-red-500/20 rounded-2xl shadow-xl shadow-red-500/5 space-y-6">
      {/* Icon header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight text-white uppercase font-orbitron">
            Error en {section}
          </h2>
          <p className="text-white/40 text-xs uppercase tracking-wider mt-0.5">Fallo de Configuración del Servidor</p>
        </div>
      </div>

      <div className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-xs text-red-400/90 leading-relaxed overflow-x-auto break-all">
        {errorMessage}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">¿Cómo solucionarlo?</h3>
        <p className="text-sm text-white/60 leading-relaxed">
          {isServiceRoleError ? (
            <span>
              La clave de rol de servicio (<code className="text-neon-cyan bg-neon-cyan/5 px-1.5 py-0.5 rounded font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>) no se encuentra definida o no es correcta en el entorno de producción. Debes configurarla en el panel de control de tu hosting (como Vercel) con los valores obtenidos de tu proyecto de Supabase.
            </span>
          ) : (
            <span>
              Ocurrió un error inesperado al conectar con Supabase. Verifica el estado de la base de datos de tu proyecto y que la variable de entorno de producción contenga las credenciales correctas.
            </span>
          )}
        </p>
      </div>

      <div className="pt-4 border-t border-white/5 flex gap-4">
        <Link
          href="/tournaments"
          className="flex-1 text-center bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
        >
          Ir al Inicio
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="flex-1 text-center bg-neon-cyan/10 border border-neon-cyan/20 hover:bg-neon-cyan/20 text-neon-cyan py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
