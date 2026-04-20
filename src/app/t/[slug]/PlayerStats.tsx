'use client'

import type { Participant } from '@/types'

const RANK_COLORS: Record<string, string> = {
  bronce: '#cd7f32',
  plata:  '#c0c0c0',
  oro:    '#fbbf24',
  platino:'#67e8f9',
  diamante:'#a78bfa',
  master: '#f472b6',
  predator:'#ef4444',
}

function rankColor(rank: string): string {
  const key = rank.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [k, v] of Object.entries(RANK_COLORS)) {
    if (key.includes(k)) return v
  }
  return '#ffffff'
}

interface Team {
  id: string
  name: string
  avatarUrl?: string
  participants: Participant[]
}

export function PlayerStats({ teams }: { teams: Team[] }) {
  const hasAnyStats = teams.some(t =>
    t.participants.some(p => p.kdRatio != null || p.avgKills != null || p.classificationRank || p.brAvgPlacement != null || p.avatarUrl)
  )
  if (!hasAnyStats) return null

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: 'rgba(167,139,250,0.6)', fontFamily: 'Orbitron, sans-serif', marginBottom: '1.25rem', textTransform: 'uppercase' }}>
        Estadísticas de Jugadores
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {teams.map(team => {
          const players = team.participants.filter(p =>
            p.kdRatio != null || p.avgKills != null || p.classificationRank || p.brAvgPlacement != null || p.avatarUrl
          )
          if (players.length === 0) return null

          return (
            <div key={team.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {team.avatarUrl && (
                  <img src={team.avatarUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '8px', objectFit: 'contain' }} />
                )}
                <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {team.name}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {players.map(p => (
                  <div key={p.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'border-color 0.2s',
                  }}>
                    {/* Avatar */}
                    <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.displayName}
                          style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '12px' }}
                        />
                      ) : (
                        <div style={{
                          width: '64px', height: '64px', borderRadius: '12px',
                          background: 'rgba(167,139,250,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.2)" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      {p.isCaptain && (
                        <span style={{
                          position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)',
                          background: 'rgba(6,182,212,0.9)', color: '#fff',
                          fontSize: '0.45rem', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em',
                          padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap',
                        }}>
                          CAP
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <p style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em', textAlign: 'center', marginTop: p.isCaptain ? '0.5rem' : '0' }}>
                      {p.displayName}
                    </p>

                    {/* Stats grid */}
                    {(p.kdRatio != null || p.avgKills != null || p.classificationRank || p.brAvgPlacement != null) && (
                      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginTop: '0.25rem' }}>
                        {p.kdRatio != null && (
                          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.4rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>K/D</p>
                            <p style={{ fontSize: '0.9rem', fontFamily: 'Orbitron, sans-serif', color: '#67e8f9', fontWeight: 900 }}>{p.kdRatio.toFixed(2)}</p>
                          </div>
                        )}
                        {p.avgKills != null && (
                          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.4rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>AVG K</p>
                            <p style={{ fontSize: '0.9rem', fontFamily: 'Orbitron, sans-serif', color: '#a78bfa', fontWeight: 900 }}>{p.avgKills.toFixed(1)}</p>
                          </div>
                        )}
                        {p.classificationRank && (
                          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.4rem', textAlign: 'center', gridColumn: p.brAvgPlacement == null ? 'span 2' : undefined }}>
                            <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>RANGO</p>
                            <p style={{ fontSize: '0.7rem', fontFamily: 'Orbitron, sans-serif', color: rankColor(p.classificationRank), fontWeight: 900 }}>{p.classificationRank}</p>
                          </div>
                        )}
                        {p.brAvgPlacement != null && (
                          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.4rem', textAlign: 'center', gridColumn: !p.classificationRank ? 'span 2' : undefined }}>
                            <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>POS. BR</p>
                            <p style={{ fontSize: '0.9rem', fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.7)', fontWeight: 900 }}>#{p.brAvgPlacement.toFixed(0)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
