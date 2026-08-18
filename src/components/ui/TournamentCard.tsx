'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { GlowCard } from './GlowCard'
import { getOptimizedImageUrl } from '@/lib/utils'

interface TournamentCardProps {
  t: any
  primaryColor: string
  secondaryColor: string
  DISCIPLINE_LABELS: Record<string, string>
}

export function TournamentCard({
  t,
  primaryColor,
  secondaryColor,
  DISCIPLINE_LABELS
}: TournamentCardProps) {
  const totalPrize = Number(t.prize_1st || 0) + Number(t.prize_2nd || 0) + Number(t.prize_3rd || 0) + Number(t.prize_mvp || 0)
  const totalTeamsRegistered = t.teams?.length || 0
  const maxTeams = t.max_teams
  const spotsLeft = maxTeams ? Math.max(0, maxTeams - totalTeamsRegistered) : null
  const hasLogo = !!t.logo_url

  return (
    <GlowCard 
      glowColor={primaryColor} 
      borderColor="rgba(255, 255, 255, 0.05)" 
      className="h-full flex flex-col justify-between overflow-hidden relative group p-5 transition-all duration-300 hover:scale-[1.01]"
    >
      {/* Active Tournament Laser Scan */}
      {t.status === 'active' && (
        <motion.div
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#00F5FF]/40 to-transparent pointer-events-none z-20"
        />
      )}

      {/* Cyber HUD Corner Brackets */}
      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-white/10 group-hover:border-neon-cyan/50 transition-colors pointer-events-none" />
      <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-white/10 group-hover:border-neon-cyan/50 transition-colors pointer-events-none" />
      <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-white/10 group-hover:border-neon-cyan/50 transition-colors pointer-events-none" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-white/10 group-hover:border-neon-cyan/50 transition-colors pointer-events-none" />

      {/* Decorative cyber stripes inside */}
      <div className="absolute top-0 right-8 w-16 h-[2px] bg-white/[0.02] group-hover:bg-neon-cyan/20 transition-colors pointer-events-none" />

      <div>
        {/* Header: Badge & Mode */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            {(() => {
              if (t.status === 'active') {
                return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                    En Curso
                  </span>
                )
              }
              if (t.status === 'finished') {
                return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-gold/10 text-gold border border-gold/20">
                    Finalizado
                  </span>
                )
              }
              const now = new Date()
              const regStart = t.registration_start_date ? new Date(t.registration_start_date) : null
              const regEnd = t.registration_end_date ? new Date(t.registration_end_date) : null

              if (regStart && now < regStart) {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-white/10 text-white/60 border border-white/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    Próximamente
                  </span>
                )
              }
              if (regEnd && now > regEnd) {
                return (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-red-500/10 text-red-400 border border-red-500/20">
                    Cerrado
                  </span>
                )
              }
              return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-purple animate-pulse" />
                  Inscripciones Abiertas
                </span>
              )
            })()}
            {t.is_private && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-neon-purple/10 text-neon-purple border border-neon-purple/20">
                <span>🔒</span> Privado
              </span>
            )}
          </div>
          <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/60 font-bold uppercase tracking-wider">
            {t.mode ? t.mode.toUpperCase() : 'TODOS'}
          </span>
        </div>

        {/* Logo & Name */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
            {hasLogo ? (
              <img src={getOptimizedImageUrl(t.logo_url, 100, 100)} alt={t.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg">🏆</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-orbitron font-bold text-sm text-white group-hover:text-neon-cyan transition-colors line-clamp-1">
              {t.name}
            </h3>
            <p className="text-neon-cyan text-[10px] font-bold tracking-wider mt-1 uppercase">
              {t.discipline ? (DISCIPLINE_LABELS[t.discipline] || t.discipline.replace(/_/g, ' ')) : 'Juego General'}
            </p>
            <p className="text-white/40 text-[9px] uppercase tracking-wide mt-0.5">
              Formato: {t.format ? t.format.replace(/_/g, ' ') : 'Estándar'}
            </p>
            {(() => {
              const creatorProfile = t.creator
              const collaboratorProfile = t.collaborator
              const isCreatorAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(creatorProfile?.role || '')

              let organizerText = ''
              if (isCreatorAdmin) {
                if (collaboratorProfile) {
                  organizerText = `Kronix & ${collaboratorProfile.organization_name || collaboratorProfile.username}`
                } else {
                  organizerText = 'Organizador'
                }
              } else {
                organizerText = creatorProfile?.organization_name || creatorProfile?.username || 'Organizador'
              }

              return (
                <p className="text-white/50 text-[9px] mt-1 font-semibold flex items-center gap-1">
                  <span className="text-neon-cyan">👑</span> Organizador: {organizerText}
                </p>
              )
            })()}
          </div>
        </div>

        {/* Capacity & Dates */}
        <div className="space-y-1.5 text-[10px] text-white/40 border-t border-white/5 pt-3 mb-4">
          {t.start_date && (
            <div className="flex justify-between">
              <span>Inicio Torneo:</span>
              <span className="text-white/60">
                {new Date(t.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}
          {maxTeams !== undefined && maxTeams !== null && maxTeams > 0 ? (
            <div className="flex justify-between">
              <span>Cupos Libres:</span>
              <span className={spotsLeft === 0 ? "text-red-400 font-bold" : "text-neon-cyan font-bold"}>
                {spotsLeft === 0 ? 'Agotado' : `${spotsLeft} / ${maxTeams}`}
              </span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span>Equipos Inscritos:</span>
              <span className="text-white/60">
                {totalTeamsRegistered}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Prize & Link */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between mt-auto">
        <div>
          <span className="text-[9px] text-white/30 uppercase block">Premio Total</span>
          <span className="text-gold font-orbitron font-black text-sm">
            {totalPrize > 0 ? `$${totalPrize.toLocaleString()}` : 'Medallas'}
          </span>
        </div>

        <Link 
          href={`/t/${t.slug}`} 
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-wider text-white hover:bg-neon-cyan hover:text-black hover:border-neon-cyan transition-all relative overflow-hidden"
        >
          Ver Torneo
        </Link>
      </div>
    </GlowCard>
  )
}
