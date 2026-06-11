'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from './auth-helpers'

export interface TournamentAnalyticsSummary {
  tournamentId: string
  tournamentName: string
  totalViews: number
  uniqueVisitors: number
  totalAdClicks: number
}

export interface AdAnalyticsSummary {
  slotName: string
  advertiserName: string
  totalClicks: number
  clickThroughUrl: string
}

export async function getPlatformAnalytics() {
  const admin = await isAdmin()
  if (!admin) throw new Error('Unauthorized')

  const supabase = await createAdminClient()

  // 1. Fetch all events
  const { data: events, error } = await supabase
    .from('tournament_analytics')
    .select(`
      *,
      tournaments(id, name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching analytics:', error)
    return { error: error.message }
  }

  // 2. Fetch all tournaments to ensure all are listed
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name')

  const tournamentMap = new Map((tournaments || []).map(t => [t.id, t.name]))

  // Calculate global totals
  const totalViews = events.filter(e => e.event_type === 'page_view').length
  const uniqueVisitors = new Set(events.map(e => e.visitor_id)).size
  const totalAdClicks = events.filter(e => e.event_type === 'click_ad').length

  // Process tournament-specific statistics
  const tournamentStats: Record<string, { views: number; visitors: Set<string>; clicks: number }> = {}

  // Initialize all tournaments with 0
  tournamentMap.forEach((name, id) => {
    tournamentStats[id] = { views: 0, visitors: new Set(), clicks: 0 }
  })

  events.forEach(event => {
    const tId = event.tournament_id
    if (!tId) return

    if (!tournamentStats[tId]) {
      tournamentStats[tId] = { views: 0, visitors: new Set(), clicks: 0 }
    }

    if (event.event_type === 'page_view') {
      tournamentStats[tId].views++
      tournamentStats[tId].visitors.add(event.visitor_id)
    } else if (event.event_type === 'click_ad') {
      tournamentStats[tId].clicks++
    }
  })

  const formattedTournaments: TournamentAnalyticsSummary[] = Object.entries(tournamentStats).map(([id, stats]) => ({
    tournamentId: id,
    tournamentName: tournamentMap.get(id) || 'Torneo Eliminado',
    totalViews: stats.views,
    uniqueVisitors: stats.visitors.size,
    totalAdClicks: stats.clicks
  })).sort((a, b) => b.totalViews - a.totalViews)

  // Process Advertising Statistics
  const adStats: Record<string, { clicks: number; advertiserName: string; clickThroughUrl: string }> = {}

  events
    .filter(e => e.event_type === 'click_ad')
    .forEach(event => {
      const meta = event.metadata || {}
      const advertiser = meta.advertiserName || 'Desconocido'
      const slot = meta.slotName || 'default'
      const key = `${slot}-${advertiser}`

      if (!adStats[key]) {
        adStats[key] = {
          clicks: 0,
          advertiserName: advertiser,
          clickThroughUrl: meta.clickThroughUrl || ''
        }
      }
      adStats[key].clicks++
    })

  const formattedAds: AdAnalyticsSummary[] = Object.entries(adStats).map(([key, stats]) => {
    const slotName = key.split('-')[0]
    return {
      slotName,
      advertiserName: stats.advertiserName,
      totalClicks: stats.clicks,
      clickThroughUrl: stats.clickThroughUrl
    }
  }).sort((a, b) => b.totalClicks - a.totalClicks)

  return {
    data: {
      global: {
        totalViews,
        uniqueVisitors,
        totalAdClicks,
        averageViewsPerTournament: formattedTournaments.length > 0
          ? Math.round(totalViews / formattedTournaments.length)
          : 0
      },
      tournaments: formattedTournaments,
      ads: formattedAds,
      rawEvents: events.slice(0, 100) // limit raw view to last 100 events
    }
  }
}
