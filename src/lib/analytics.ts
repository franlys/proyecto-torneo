'use client'

/**
 * Gets or creates a persistent visitor ID from localStorage
 */
function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server'
  
  let visitorId = localStorage.getItem('kronix_visitor_id')
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    localStorage.setItem('kronix_visitor_id', visitorId)
  }
  return visitorId
}

interface TrackEventProps {
  tournamentId?: string
  eventType: 'page_view' | 'click_stream' | 'click_ad'
  path?: string
  metadata?: Record<string, any>
}

/**
 * Track an analytics event
 */
export function trackEvent({ tournamentId, eventType, path, metadata }: TrackEventProps) {
  if (typeof window === 'undefined') return

  const visitorId = getVisitorId()
  const currentPath = path || window.location.pathname

  fetch('/api/analytics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tournamentId,
      eventType,
      path: currentPath,
      visitorId,
      metadata: {
        ...metadata,
        userAgent: navigator.userAgent,
        referrer: document.referrer || undefined,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
      }
    }),
  }).catch((err) => {
    // Fail silently in production
    console.warn('Analytics tracking failed:', err)
  })
}
