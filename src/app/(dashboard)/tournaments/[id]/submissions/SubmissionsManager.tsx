'use client'

import { useState } from 'react'
import { approveSubmission, rejectSubmission } from '@/lib/actions/submissions'

type PendingSubmission = {
  id: string
  tournament_id: string
  team_id: string
  match_id: string
  submitted_by: string
  kill_count: number
  pot_top: boolean
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  submitted_at: string
  teams?: { name: string } | { name: string }[]
  matches?: { name: string; match_number: number } | { name: string; match_number: number }[]
  ai_status?: 'pending' | 'processing' | 'completed' | 'failed'
  ai_data?: { team_name?: string; kill_count?: number; rank?: number }
  ai_confidence?: number
  ai_error?: string
}

export function SubmissionsManager({
  tournamentId,
  initialSubmissions,
}: {
  tournamentId: string
  initialSubmissions: PendingSubmission[]
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleApprove = async (id: string) => {
    setLoadingId(id)
    try {
      const res = await approveSubmission(id)
      if ('error' in res) throw new Error(res.error)
      
      setSubmissions(submissions.map(s => s.id === id ? { ...s, status: 'approved' } : s))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Motivo del rechazo:')
    if (reason === null) return // cancelled
    
    setLoadingId(id)
    try {
      const res = await rejectSubmission(id, reason || 'Envío inválido')
      if ('error' in res) throw new Error(res.error)
      
      setSubmissions(submissions.map(s => s.id === id ? { ...s, status: 'rejected', rejection_reason: reason || 'Envío inválido' } : s))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingId(null)
    }
  }

  // Parse arrays if Supabase returned un-unwrapped values due to 1:M assumptions when we select from views
  const getTeamName = (s: PendingSubmission) => Array.isArray(s.teams) ? s.teams[0]?.name : s.teams?.name || 'Equipo desconocido'
  const getMatchName = (s: PendingSubmission) => Array.isArray(s.matches) ? s.matches[0]?.name : s.matches?.name || 'Partida'

  // Group submissions by match
  const submissionsByMatch = submissions.reduce((acc, sub) => {
    const matchId = sub.match_id
    if (!acc[matchId]) acc[matchId] = []
    acc[matchId].push(sub)
    return acc
  }, {} as Record<string, PendingSubmission[]>)

  // Sort match IDs by match number (if available)
  const sortedMatchIds = Object.keys(submissionsByMatch).sort((a, b) => {
    const matchA = submissionsByMatch[a][0].matches as any
    const matchB = submissionsByMatch[b][0].matches as any
    const numA = Array.isArray(matchA) ? matchA[0]?.match_number : matchA?.match_number
    const numB = Array.isArray(matchB) ? matchB[0]?.match_number : matchB?.match_number
    return (numA || 0) - (numB || 0)
  })

  return (
    <div className="space-y-12">
      {submissions.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
          <p className="text-white/40 text-sm">No hay envíos registrados aún</p>
        </div>
      ) : (
        sortedMatchIds.map(matchId => {
          const matchSubmissions = submissionsByMatch[matchId]
          const matchName = getMatchName(matchSubmissions[0])
          
          return (
            <div key={matchId} className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="font-orbitron text-lg font-bold text-neon-cyan tracking-wider truncate">
                  {matchName}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-neon-cyan/30 to-transparent" />
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                  {matchSubmissions.length} ENVÍOS
                </span>
              </div>
              
              <div className="bg-dark-card border border-white/5 rounded-xl overflow-hidden shadow-lg shadow-black/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-white/40 uppercase bg-white/[0.02] border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4 font-medium">Equipo/Jugador</th>
                        <th className="px-6 py-4 font-medium text-center">Kills</th>
                        <th className="px-6 py-4 font-medium text-center">Pot Top</th>
                        <th className="px-6 py-4 font-medium">Validación IA</th>
                        <th className="px-6 py-4 font-medium">Estado</th>
                        <th className="px-6 py-4 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {matchSubmissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-medium text-white">{getTeamName(sub)}</td>
                          <td className="px-6 py-4 text-center font-orbitron text-neon-cyan">{sub.kill_count}</td>
                          <td className="px-6 py-4 text-center">
                            {sub.pot_top ? (
                              <span className="inline-flex max-w-fit mx-auto px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-gold/20 text-gold border border-gold/30">Sí</span>
                            ) : (
                              <span className="text-white/20">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {sub.ai_status === 'processing' && (
                              <div className="flex items-center gap-2 text-white/40">
                                <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Analizando...</span>
                              </div>
                            )}
                            {sub.ai_status === 'failed' && (
                              <div className="flex items-center gap-2 text-red-400/60" title={sub.ai_error}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span className="text-[10px] uppercase font-bold tracking-widest">Error IA</span>
                              </div>
                            )}
                            {sub.ai_status === 'completed' && sub.ai_data && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                   <div className={`w-1.5 h-1.5 rounded-full ${sub.ai_data.kill_count === sub.kill_count ? 'bg-green-400' : 'bg-orange-400'}`} />
                                   <span className="text-[10px] text-white/60 font-medium">Kills detectadas: <b className="text-white">{sub.ai_data.kill_count}</b></span>
                                </div>
                                <div className="flex items-center gap-2">
                                   {sub.ai_confidence && sub.ai_confidence > 0.8 ? (
                                     <span className="text-[8px] bg-green-500/10 text-green-400 px-1 rounded border border-green-500/20 uppercase font-black tracking-tighter">Alta Confianza</span>
                                   ) : (
                                     <span className="text-[8px] bg-orange-500/10 text-orange-400 px-1 rounded border border-orange-500/20 uppercase font-black tracking-tighter">Revisión Manual</span>
                                   )}
                                </div>
                              </div>
                            )}
                            {!sub.ai_status && (
                              <span className="text-white/10 text-[10px] uppercase tracking-widest font-bold">Sin análisis</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {sub.status === 'pending' && <span className="text-yellow-400">Pendiente</span>}
                            {sub.status === 'approved' && <span className="text-green-400 font-bold">Aprobado</span>}
                            {sub.status === 'rejected' && (
                              <div className="group relative w-max cursor-help text-red-400">
                                Rechazado
                                <div className="absolute top-0 left-[110%] ml-2 w-48 p-2 bg-black/90 border border-white/10 rounded text-xs text-white/70 opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                                  {sub.rejection_reason}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {sub.status === 'pending' && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApprove(sub.id)}
                                  disabled={loadingId === sub.id}
                                  className="p-1.5 text-white/50 hover:text-green-400 hover:bg-green-400/10 rounded transition-colors"
                                  title="Aprobar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleReject(sub.id)}
                                  disabled={loadingId === sub.id}
                                  className="p-1.5 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                  title="Rechazar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
