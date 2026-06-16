'use client'

import { useEffect, useState, useRef } from 'react'
import { Orbitron } from 'next/font/google'

const orbitron = Orbitron({ subsets: ['latin'] })

export function WelcomeVideoModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Check if the user has already seen the welcome intro
    const hasSeen = localStorage.getItem('has_seen_welcome_intro_v2')
    if (!hasSeen) {
      setIsOpen(true)
    }
  }, [])

  const handleClose = () => {
    setIsFadingOut(true)
    localStorage.setItem('has_seen_welcome_intro_v2', 'true')
    
    // Smooth transition: Wait for fade out animation to finish before removing from DOM
    setTimeout(() => {
      setIsOpen(false)
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }, 800) // matches transition duration
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-black flex flex-col justify-between items-center transition-all duration-700 ease-in-out ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Video covering the entire screen */}
      <div className="absolute inset-0 w-full h-full bg-black z-0">
        <video
          ref={videoRef}
          src="/bienvenida.mp4"
          autoPlay
          muted={isMuted}
          playsInline
          onEnded={handleClose}
          className="w-full h-full object-cover"
        />
        {/* Dark overlay to give contrast if video is too bright */}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      </div>

      {/* Top Header controls (floating overlay) */}
      <div className="relative z-10 w-full flex justify-between items-center px-6 py-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-[0_0_10px_#00F5FF]" />
          <span className={`${orbitron.className} text-[10px] font-black uppercase tracking-[0.3em] text-white/90`}>
            KRONIX INTRO
          </span>
        </div>

        <button 
          onClick={handleClose} 
          className={`${orbitron.className} text-white/80 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 hover:border-neon-cyan/50 hover:shadow-[0_0_15px_rgba(0,245,255,0.2)]`}
        >
          Saltar Intro ✕
        </button>
      </div>

      {/* Center interaction helper (fade out when user interacts) */}
      <div className="relative z-10 text-center select-none pointer-events-none">
        {/* Optional decorative loading pulse */}
      </div>

      {/* Bottom controls (floating overlay) */}
      <div className="relative z-10 w-full flex flex-col sm:flex-row justify-between items-center px-8 py-8 bg-gradient-to-t from-black/80 to-transparent gap-4">
        <button
          onClick={toggleMute}
          className="flex items-center gap-2.5 px-5 py-3 bg-black/50 hover:bg-black/80 border border-white/10 hover:border-neon-cyan/50 text-white rounded-xl text-xs font-bold transition-all backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
        >
          {isMuted ? (
            <>
              <span className="text-sm">🔊</span> Activar Sonido
            </>
          ) : (
            <>
              <span className="text-sm">🔇</span> Silenciar
            </>
          )}
        </button>

        <p className="text-white/40 text-[9px] uppercase tracking-widest text-center sm:text-right">
          El portal se revelará automáticamente al finalizar el video
        </p>
      </div>
    </div>
  )
}
