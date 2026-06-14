'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Orbitron } from 'next/font/google'

const orbitron = Orbitron({ subsets: ['latin'] })

interface NavbarProps {
  user: any
  profile: any
}

export function Navbar({ user, profile }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-20 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5 z-50 px-6 sm:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img 
              src="/logo.png" 
              alt="KRONIX Logo" 
              className="w-7 h-7 object-contain transition-transform duration-300 group-hover:scale-105" 
            />
            <span className="font-sans font-black tracking-[0.2em] text-sm text-white uppercase transition-colors group-hover:text-neon-cyan duration-300">
              KRONIX
            </span>
          </Link>
          <span className="text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/40">
            NATIONAL HUB 🇩🇴
          </span>
        </div>

        {/* Desktop Links (Simplified) */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Inicio</Link>
          <Link href="/torneos" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Torneos Públicos</Link>
          <Link href="/rankings" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Rankings</Link>
          <Link href="/copas" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Copas Oficiales</Link>
          <Link href="/hall-of-fame" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Hall of Fame</Link>
        </div>

        {/* Dashboard/Access + Hamburger Button */}
        <div className="flex items-center gap-4">
          {user ? (
            <Link 
              href="/tournaments" 
              className="hidden sm:inline-block bg-white text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neon-cyan hover:scale-[1.02] transition-all"
            >
              Dashboard
            </Link>
          ) : (
            <Link 
              href="/login" 
              className="hidden sm:inline-block bg-white text-black px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neon-cyan hover:scale-[1.02] transition-all"
            >
              Acceso Streamer
            </Link>
          )}

          {/* Hamburger Icon */}
          <button 
            onClick={toggleMenu} 
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all focus:outline-none"
            aria-label="Toggle menu"
          >
            <div className="w-5 flex flex-col gap-1.5 justify-center items-center">
              <span className={`h-0.5 w-full bg-white rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`h-0.5 w-full bg-white rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 w-full bg-white rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      {/* Hamburger Overlay Sidepanel */}
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={toggleMenu} />

      <aside className={`fixed top-0 right-0 w-80 h-full bg-[#0d0d0f] border-l border-white/5 z-50 p-8 flex flex-col justify-between transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="space-y-12">
          {/* Menu Header */}
          <div className="flex items-center justify-between">
            <span className={`${orbitron.className} text-lg font-black text-white`}>MENÚ</span>
            <button 
              onClick={toggleMenu} 
              className="text-xs font-black uppercase tracking-widest text-white/40 hover:text-white"
            >
              Cerrar ✕
            </button>
          </div>

          {/* Nav Links */}
          <div className="flex flex-col gap-6">
            <Link 
              href="/" 
              onClick={toggleMenu}
              className="text-lg font-black uppercase tracking-widest text-white/60 hover:text-neon-cyan transition-colors"
            >
              Inicio
            </Link>
            <Link 
              href="/torneos" 
              onClick={toggleMenu}
              className="text-lg font-black uppercase tracking-widest text-white/60 hover:text-neon-cyan transition-colors"
            >
              Torneos Públicos
            </Link>
            <Link 
              href="/rankings" 
              onClick={toggleMenu}
              className="text-lg font-black uppercase tracking-widest text-white/60 hover:text-neon-cyan transition-colors"
            >
              Rankings Nacionales
            </Link>
            <Link 
              href="/copas" 
              onClick={toggleMenu}
              className="text-lg font-black uppercase tracking-widest text-white/60 hover:text-neon-cyan transition-colors"
            >
              Copas Oficiales
            </Link>
            <Link 
              href="/hall-of-fame" 
              onClick={toggleMenu}
              className="text-lg font-black uppercase tracking-widest text-white/60 hover:text-neon-cyan transition-colors"
            >
              Hall of Fame
            </Link>
            <Link 
              href="#membresias" 
              onClick={toggleMenu}
              className="text-lg font-black uppercase tracking-widest text-white/60 hover:text-neon-purple transition-colors"
            >
              Solicitar Membresía
            </Link>
          </div>
        </div>

        {/* Menu Footer (Call to action) */}
        <div className="space-y-4 pt-6 border-t border-white/5">
          {user ? (
            <div className="space-y-3">
              <div className="text-xs text-white/40 font-bold uppercase tracking-wider">
                Usuario: <span className="text-white">{profile?.username || 'Registrado'}</span>
              </div>
              <Link 
                href="/tournaments" 
                onClick={toggleMenu}
                className="w-full block text-center bg-white text-black py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neon-cyan transition-all"
              >
                Ir al Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <Link 
                href="/login" 
                onClick={toggleMenu}
                className="w-full block text-center bg-neon-cyan text-black py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
              >
                Acceso Streamer
              </Link>
              <p className="text-[10px] text-white/30 text-center uppercase tracking-widest font-semibold leading-relaxed">
                Membresía Pro para gestores de torneos.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
