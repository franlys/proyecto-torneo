'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

interface HomeTrackerProps {
  path: string
  tournamentId?: string
  metadata?: Record<string, any>
}

export function HomeTracker({ path, tournamentId, metadata }: HomeTrackerProps) {
  useEffect(() => {
    trackEvent({
      eventType: 'page_view',
      path,
      tournamentId,
      metadata
    })
  }, [path, tournamentId, metadata])

  return null
}
