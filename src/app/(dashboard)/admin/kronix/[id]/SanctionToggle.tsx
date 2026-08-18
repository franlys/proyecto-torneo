'use client'

import { useState, useTransition } from 'react'
import { toggleTournamentSanction } from '@/lib/actions/federation'
import { useRouter } from 'next/navigation'

interface SanctionToggleProps {
  tournamentId: string
  initialSanctioned: boolean
}

export function SanctionToggle({ tournamentId, initialSanctioned }: SanctionToggleProps) {
  const [isSanctioned, setIsSanctioned] = useState(initialSanctioned)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleToggle = () => {
    const newValue = !isSanctioned
    setIsSanctioned(newValue)
    startTransition(async () => {
      const result = await toggleTournamentSanction(tournamentId, newValue)
      if ('error' in result) {
        setIsSanctioned(!newValue) // Revert on error
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
        isSanctioned
          ? 'bg-neon-cyan text-black hover:bg-neon-cyan/80'
          : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10'
      } disabled:opacity-50`}
    >
      {isPending ? 'Procesando...' : isSanctioned ? '✓ Avalado por Federación' : 'Avalar Torneo'}
    </button>
  )
}
