'use client'

import { useState } from 'react'
import { toggleRankingLicense } from '@/lib/actions/federation'
import { useRouter } from 'next/navigation'

interface LicenseToggleProps {
  streamerId: string
  initialHasLicense: boolean
}

export function LicenseToggle({ streamerId, initialHasLicense }: LicenseToggleProps) {
  const [hasLicense, setHasLicense] = useState(initialHasLicense)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleToggle = async () => {
    setLoading(true)
    const nextState = !hasLicense
    const res = await toggleRankingLicense(streamerId, nextState)
    if ('error' in res) {
      alert(res.error)
    } else {
      setHasLicense(nextState)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
        hasLicense
          ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan/20'
          : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white'
      } disabled:opacity-50`}
    >
      {loading ? '...' : hasLicense ? '⭐ Con Licencia' : 'Sin Licencia'}
    </button>
  )
}
