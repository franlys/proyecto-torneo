'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isAdmin } from './auth-helpers'
import { revalidatePath } from 'next/cache'

export interface LandingSettings {
  id?: string
  hero_title: string
  hero_subtitle: string
  live_ticker_text: string
  statistics_ticker_text: string
  primary_color: string
  secondary_color: string
  ambient_video_url: string
}

export async function getLandingSettings(): Promise<LandingSettings> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('landing_page_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) throw error

    // Fallback default configuration if not in database yet
    if (!data) {
      return {
        hero_title: 'EL PORTAL DE LOS E-SPORTS DOMINICANOS',
        hero_subtitle: 'La herramienta definitiva de clasificación nacional. Consulta estadísticas de atletas, descubre torneos avalados por la Federación y visualiza los rankings de la República Dominicana.',
        live_ticker_text: '● 3 Torneos Activos ahora · 👥 12,450 Espectadores',
        statistics_ticker_text: '🏆 120+ Torneos Realizados ── 🛡️ 4,500+ Atletas Federados ── 📺 1.2M+ Minutos de Stream',
        primary_color: '#00F5FF',
        secondary_color: '#BD00FF',
        ambient_video_url: ''
      }
    }

    return {
      id: data.id,
      hero_title: data.hero_title,
      hero_subtitle: data.hero_subtitle,
      live_ticker_text: data.live_ticker_text,
      statistics_ticker_text: data.statistics_ticker_text,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      ambient_video_url: data.ambient_video_url
    }
  } catch (err) {
    console.error('Error in getLandingSettings:', err)
    return {
      hero_title: 'EL PORTAL DE LOS E-SPORTS DOMINICANOS',
      hero_subtitle: 'La herramienta definitiva de clasificación nacional. Consulta estadísticas de atletas, descubre torneos avalados por la Federación y visualiza los rankings de la República Dominicana.',
      live_ticker_text: '● 3 Torneos Activos ahora · 👥 12,450 Espectadores',
      statistics_ticker_text: '🏆 120+ Torneos Realizados ── 🛡️ 4,500+ Atletas Federados ── 📺 1.2M+ Minutos de Stream',
      primary_color: '#00F5FF',
      secondary_color: '#BD00FF',
      ambient_video_url: ''
    }
  }
}

export async function updateLandingSettings(settings: Partial<LandingSettings>) {
  try {
    const admin = await isAdmin()
    if (!admin) throw new Error('Unauthorized')

    const supabase = await createAdminClient()

    // Get current record first to check if we insert or update
    const { data: existing } = await supabase
      .from('landing_page_settings')
      .select('id')
      .limit(1)
      .maybeSingle()

    let res
    if (existing?.id) {
      res = await supabase
        .from('landing_page_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      res = await supabase
        .from('landing_page_settings')
        .insert({
          hero_title: settings.hero_title || 'EL PORTAL DE LOS E-SPORTS DOMINICANOS',
          hero_subtitle: settings.hero_subtitle || 'La herramienta definitiva de clasificación nacional.',
          live_ticker_text: settings.live_ticker_text || '● Torneo Activo',
          statistics_ticker_text: settings.statistics_ticker_text || '🏆 Stats',
          primary_color: settings.primary_color || '#00F5FF',
          secondary_color: settings.secondary_color || '#BD00FF',
          ambient_video_url: settings.ambient_video_url || ''
        })
    }

    if (res.error) throw res.error

    revalidatePath('/')
    return { success: true }
  } catch (err: any) {
    console.error('Error in updateLandingSettings:', err)
    return { error: err.message || 'Error updating settings' }
  }
}
