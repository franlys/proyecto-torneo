'use client'

import { Orbitron } from 'next/font/google'
import Link from 'next/link'

const orbitron = Orbitron({ subsets: ['latin'] })

interface ArenaPromoBannerProps {
  tournamentSlug: string
}

export function ArenaPromoBanner({ tournamentSlug }: ArenaPromoBannerProps) {
  return (
    <div className="w-full bg-[#0a0a0b] border-y border-neon-cyan/20 overflow-hidden relative group">
      {/* Animated Glow Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 via-transparent to-neon-purple/5 opacity-50" />
      <div className="absolute -left-1/4 top-0 w-1/2 h-full bg-neon-cyan/10 blur-[100px] animate-pulse" />
      
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,245,255,0.1)]">
            <span className="text-2xl">⚡</span>
          </div>
          <div>
            <h3 className={`${orbitron.className} text-white text-lg font-black uppercase tracking-wider`}>
              Apuesta en <span className="text-neon-cyan neon-text-cyan">ArenaCrypto</span>
            </h3>
            <p className="text-white/40 text-xs uppercase tracking-widest font-bold">
              Usa el código de tu streamer para apostar <span className="text-neon-cyan">GRATIS</span> o hazte Premium
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <Link 
            href={`https://arenacrypto.app/tournaments/${tournamentSlug}?ref=stream`}
            target="_blank"
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl bg-neon-cyan text-black font-black text-xs uppercase tracking-widest hover:shadow-[0_0_25px_rgba(0,245,255,0.4)] hover:scale-[1.02] transition-all active:scale-[0.98] ${orbitron.className}`}
          >
            Ir a Apostar Ahora
          </Link>
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] text-white/20 uppercase font-black">Acceso Exclusivo</span>
            <span className="text-xs text-neon-purple font-bold">Streamer Codes OK</span>
          </div>
        </div>
      </div>

      {/* Separator line with animation */}
      <div className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent w-full opacity-30 shadow-[0_0_10px_#00F5FF]" />
    </div>
  )
}
