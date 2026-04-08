'use server'

import { createClient } from '@/lib/supabase/server'
import { getTournament } from './tournaments'

export async function exportTournamentDataCsv(tournamentId: string): Promise<{ data: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Fetch Tournament
  const tRes = await getTournament(tournamentId)
  if ('error' in tRes) return { error: tRes.error }
  const tournament = tRes.data

  // 2. Fetch Standings
  const { data: standings } = await supabase
    .from('team_standings')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })

  // 3. Fetch Participants (for MVP)
  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('total_kills', { ascending: false })

  if (!standings) return { error: 'No hay datos para exportar' }

  // 4. Generate CSV
  let csv = `Reporte Final - ${tournament.name}\n`
  csv += `Formato: ${tournament.format}\n`
  csv += `Estado: ${tournament.status}\n\n`

  csv += `RANKING DE EQUIPOS\n`
  csv += `Posicion,Equipo,Kills Totales,VIP Score,PUNTOS TOTALES\n`
  standings.forEach(s => {
    // In a real CSV we should escape names, but keep it simple for now
    csv += `${s.rank},${s.team_name},${s.total_kills},${s.vip_score},${s.total_points}\n`
  })

  csv += `\nESTADISTICAS INDIVIDUALES (TOP FRAGGER)\n`
  csv += `Jugador,Kills Individuales\n`
  participants?.forEach(p => {
    csv += `${p.display_name},${p.total_kills || 0}\n`
  })

  return { data: csv }
}
