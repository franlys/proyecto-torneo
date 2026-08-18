'use client'

import React, { useRef, useState } from 'react'

interface GlowCardProps {
  children: React.ReactNode
  className?: string
  glowColor?: string // e.g. '#00F5FF' for cyan
  borderColor?: string // fallback border color
}

export function GlowCard({
  children,
  className = '',
  glowColor = '#00F5FF',
  borderColor = 'rgba(255, 255, 255, 0.05)'
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [isFocused, setIsFocused] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setCoords({ x, y })
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${className}`}
      style={{
        borderColor: isFocused ? 'rgba(255,255,255,0.08)' : borderColor,
        backgroundColor: 'rgba(255, 255, 255, 0.01)'
      }}
    >
      {/* Dynamic Glow Spotlight Background */}
      {isFocused && (
        <div
          className="absolute pointer-events-none transition-opacity duration-300 -z-10"
          style={{
            width: '350px',
            height: '350px',
            background: `radial-gradient(circle, ${glowColor}1c 0%, transparent 70%)`,
            left: `${coords.x - 175}px`,
            top: `${coords.y - 175}px`,
          }}
        />
      )}

      {/* Border Glow Spotlight Overlay */}
      {isFocused && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl -z-10"
          style={{
            background: `radial-gradient(circle 80px at ${coords.x}px ${coords.y}px, ${glowColor}50 0%, transparent 100%)`,
            padding: '1px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      {/* Card Content */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  )
}
