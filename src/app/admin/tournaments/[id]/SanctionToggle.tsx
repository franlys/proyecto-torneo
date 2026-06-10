'use client'

import { useState } from 'react'
import { toggleTournamentSanction } from '@/lib/actions/federation'
import { useRouter } from 'next/navigation'

interface SanctionToggleProps {
  tournamentId: string
  initialSanctioned: boolean
}

export function SanctionToggle({ tournamentId, initialSanctioned }: SanctionToggleProps) {
  const [isSanctioned, setIsSanctioned] = useState(initialSanctioned)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleToggle = async () => {
    setLoading(true)
    const nextState = !isSanctioned
    const res = await toggleTournamentSanction(tournamentId, nextState)
    if ('error' in res) {
      alert(res.error)
    } else {
      setIsSanctioned(nextState)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-5 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border shrink-0 ${
        isSanctioned
          ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30'
          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
      } disabled:opacity-50`}
    >
      {loading ? 'Procesando...' : isSanctioned ? '🏆 Avalado por la FDDE' : '⚠️ Sin aval (Avalar)'}
    </button>
  )
}
