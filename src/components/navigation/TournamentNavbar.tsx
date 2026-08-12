'use client'

import { Orbitron } from 'next/font/google'
import Link from 'next/link'

const orbitron = Orbitron({ subsets: ['latin'] })

interface TournamentNavbarProps {
  user: any
  profile: any
  tournamentName: string
  tournamentSlug: string
  balance?: number
}

export function TournamentNavbar({
  user,
  profile,
  tournamentName,
  tournamentSlug,
  balance = 0,
}: TournamentNavbarProps) {
  const username = profile?.username || user?.email?.split('@')[0] || 'Usuario'
  const avatarUrl = profile?.avatar_url || null

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#0a0a0b]/90 backdrop-blur-xl border-b border-white/5 z-50 px-4 sm:px-8 flex items-center justify-between">
      {/* Brand Logo & Arena Pill */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group">
          <img
            src="/logo.png"
            alt="KRONIX Logo"
            className="w-7 h-7 object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <span className="font-sans font-black tracking-[0.2em] text-sm text-white uppercase transition-colors group-hover:text-neon-cyan duration-300">
            KRONIX
          </span>
        </Link>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-neon-cyan">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
          ARENA OFICIAL
        </span>
      </div>

      {/* Center: Tournament Name */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-white/40 text-xs font-bold uppercase tracking-wider">Torneo:</span>
        <span className={`${orbitron.className} text-xs font-black text-white tracking-wider truncate max-w-[200px]`}>
          {tournamentName}
        </span>
      </div>

      {/* Right Side: Balance, Profile / Login */}
      <div className="flex items-center gap-2.5">
        {user ? (
          <>
            {/* Wallet pill */}
            <Link
              href="/wallet"
              className="flex items-center gap-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 rounded-xl transition-all"
              title="Mi Billetera"
            >
              <span className="text-sm">🪙</span>
              <span className="font-orbitron font-bold text-xs text-yellow-300">
                {Number(balance).toFixed(2)}
              </span>
              <span className="text-[10px] text-yellow-500/80 font-mono hidden sm:inline">K-Coins</span>
            </Link>

            {/* Profile Avatar Pill */}
            <Link
              href="/profile"
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl px-2.5 py-1.5 transition-all group"
              title="Mi Perfil"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-neon-cyan/40"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-neon-cyan/30 to-neon-purple/30 border border-neon-cyan/20 flex items-center justify-center text-[10px] font-black text-neon-cyan">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-bold text-white/80 group-hover:text-white max-w-[90px] truncate hidden sm:inline">
                {username}
              </span>
            </Link>
          </>
        ) : (
          <Link
            href={`/login?redirectTo=/t/${tournamentSlug}`}
            className="bg-white text-black px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neon-cyan transition-all shadow-sm"
          >
            Iniciar Sesión
          </Link>
        )}
      </div>
    </header>
  )
}
