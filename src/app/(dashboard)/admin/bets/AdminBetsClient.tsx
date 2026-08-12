'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import {
  createPredictionMarketAction,
  closePredictionMarketAction,
  resolvePredictionMarketAction,
  cancelPredictionMarketAction,
} from '@/lib/actions/predictions'

interface Props {
  tournaments: { id: string; name: string; slug: string; arena_betting_enabled: boolean }[]
  matches: { id: string; tournament_id: string; name: string; match_number: number; is_completed: boolean }[]
  betMarkets: any[]
  confirmedTeams: { id: string; name: string; tournament_id: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  open: 'text-green-400 bg-green-400/10 border-green-400/30',
  closed: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  resolved: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  cancelled: 'text-red-400 bg-red-400/10 border-red-400/30',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  closed: 'Cerrado',
  resolved: 'Resuelto',
  cancelled: 'Cancelado',
}

export function AdminBetsClient({ tournaments, matches, betMarkets: initialBetMarkets, confirmedTeams }: Props) {
  const [betMarkets, setBetMarkets] = useState(initialBetMarkets)
  const [isPending, startTransition] = useTransition()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [resolveModal, setResolveModal] = useState<{ market: any } | null>(null)
  const [filterTournament, setFilterTournament] = useState('')

  // Create form state
  const [selectedTournamentId, setSelectedTournamentId] = useState('')
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [marketType, setMarketType] = useState<'winner' | 'top_5' | 'top_3' | 'most_kills' | 'custom'>('winner')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<{ id: string; name: string; odds: number }[]>([
    { id: crypto.randomUUID(), name: '', odds: 1.8 },
    { id: crypto.randomUUID(), name: '', odds: 2.1 },
  ])

  const matchesForTournament = useMemo(
    () => matches.filter(m => m.tournament_id === selectedTournamentId),
    [matches, selectedTournamentId]
  )

  const teamsForTournament = useMemo(
    () => confirmedTeams.filter(t => t.tournament_id === selectedTournamentId),
    [confirmedTeams, selectedTournamentId]
  )

  const filteredMarkets = useMemo(
    () => filterTournament ? betMarkets.filter(m => m.tournament_id === filterTournament) : betMarkets,
    [betMarkets, filterTournament]
  )

  const handleAutofillTeams = (defaultOdds = 1.8) => {
    if (teamsForTournament.length === 0) {
      toast.error('No hay equipos confirmados para este torneo')
      return
    }
    setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: defaultOdds })))
    toast.success(`${teamsForTournament.length} equipos cargados`)
  }

  const handleAddOption = () => {
    setOptions(prev => [...prev, { id: crypto.randomUUID(), name: '', odds: 1.8 }])
  }

  const handleRemoveOption = (id: string) => {
    setOptions(prev => prev.filter(o => o.id !== id))
  }

  const handleOptionChange = (id: string, field: 'name' | 'odds', value: string) => {
    setOptions(prev => prev.map(o => o.id === id ? { ...o, [field]: field === 'odds' ? parseFloat(value) || 0 : value } : o))
  }

  const handleCreate = () => {
    if (!selectedTournamentId) { toast.error('Selecciona un torneo'); return }
    if (!question.trim()) { toast.error('Escribe la pregunta del mercado'); return }
    if (options.some(o => !o.name.trim())) { toast.error('Todas las opciones deben tener nombre'); return }

    startTransition(async () => {
      const res = await createPredictionMarketAction({
        tournamentId: selectedTournamentId,
        matchId: selectedMatchId || undefined,
        gameType: 'kronix',
        marketType,
        question: question.trim(),
        options,
      })

      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Mercado creado con éxito')
        const tournament = tournaments.find(t => t.id === selectedTournamentId)
        setBetMarkets(prev => [{ ...res.data, tournaments: { name: tournament?.name || '' } }, ...prev])
        setShowCreateModal(false)
        resetForm()
      }
    })
  }

  const applyPreset = (presetType: 'winner_match' | 'top5_match' | 'kills_match' | 'winner_tournament' | 'top5_tournament' | 'top3_tournament' | 'kills_tournament') => {
    if (!selectedTournamentId) {
      toast.error('Selecciona un torneo primero')
      return
    }

    const tournament = tournaments.find(t => t.id === selectedTournamentId)
    const match = matchesForTournament.find(m => m.id === selectedMatchId)
    
    // Autofill options with teams
    if (teamsForTournament.length === 0) {
      toast.error('No hay equipos confirmados para este torneo para auto-completar')
      return
    }

    if (presetType === 'winner_match') {
      if (!selectedMatchId) {
        toast.error('Selecciona una partida para esta plantilla')
        return
      }
      setMarketType('winner')
      setQuestion(`¿Qué equipo ganará la partida "${match?.name}"?`)
      setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: 2.2 })))
    } else if (presetType === 'top5_match') {
      if (!selectedMatchId) {
        toast.error('Selecciona una partida para esta plantilla')
        return
      }
      setMarketType('top_5')
      setQuestion(`¿Qué equipo quedará en el Top 5 de la partida "${match?.name}"?`)
      setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: 1.9 })))
    } else if (presetType === 'kills_match') {
      if (!selectedMatchId) {
        toast.error('Selecciona una partida para esta plantilla')
        return
      }
      setMarketType('most_kills')
      setQuestion(`¿Qué equipo tendrá más bajas (kills) en la partida "${match?.name}"?`)
      setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: 2.5 })))
    } else if (presetType === 'winner_tournament') {
      setMarketType('winner')
      setSelectedMatchId('')
      setQuestion(`¿Qué equipo se coronará campeón del torneo "${tournament?.name}"?`)
      setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: 3.5 })))
    } else if (presetType === 'top5_tournament') {
      setMarketType('top_5')
      setSelectedMatchId('')
      setQuestion(`¿Qué equipo logrará clasificar en el Top 5 general del torneo "${tournament?.name}"?`)
      setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: 2.2 })))
    } else if (presetType === 'top3_tournament') {
      setMarketType('top_3')
      setSelectedMatchId('')
      setQuestion(`¿Qué equipo subirá al Podio (Top 3) general del torneo "${tournament?.name}"?`)
      setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: 2.8 })))
    } else if (presetType === 'kills_tournament') {
      setMarketType('most_kills')
      setSelectedMatchId('')
      setQuestion(`¿Qué equipo acumulará más bajas (kills) en todo el torneo "${tournament?.name}"?`)
      setOptions(teamsForTournament.map(t => ({ id: crypto.randomUUID(), name: t.name, odds: 3.0 })))
    }
    toast.success('Plantilla cargada con éxito')
  }

  const resetForm = () => {
    setSelectedTournamentId('')
    setSelectedMatchId('')
    setMarketType('winner')
    setQuestion('')
    setOptions([
      { id: crypto.randomUUID(), name: '', odds: 1.8 },
      { id: crypto.randomUUID(), name: '', odds: 2.1 },
    ])
  }

  const handleClose = (marketId: string) => {
    startTransition(async () => {
      const res = await closePredictionMarketAction(marketId)
      if ('error' in res) { toast.error(res.error) } else {
        toast.success('Mercado cerrado — ya no se aceptan apuestas')
        setBetMarkets(prev => prev.map(m => m.id === marketId ? { ...m, status: 'closed' } : m))
      }
    })
  }

  const handleResolve = (winningOptionId: string) => {
    if (!resolveModal) return
    startTransition(async () => {
      const res = await resolvePredictionMarketAction(resolveModal.market.id, winningOptionId)
      if ('error' in res) { toast.error(res.error) } else {
        toast.success('Mercado resuelto y pagos procesados')
        setBetMarkets(prev => prev.map(m =>
          m.id === resolveModal.market.id
            ? { ...m, status: 'resolved', winning_option_id: winningOptionId }
            : m
        ))
        setResolveModal(null)
      }
    })
  }

  const handleCancel = (marketId: string) => {
    if (!confirm('¿Cancelar este mercado? Se reembolsarán todas las apuestas.')) return
    startTransition(async () => {
      const res = await cancelPredictionMarketAction(marketId)
      if ('error' in res) { toast.error(res.error) } else {
        toast.success('Mercado cancelado — apuestas reembolsadas')
        setBetMarkets(prev => prev.map(m => m.id === marketId ? { ...m, status: 'cancelled' } : m))
      }
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-orbitron font-black text-2xl sm:text-3xl text-white uppercase tracking-tight flex items-center gap-3">
            <span className="text-3xl">🪙</span> Control de Apuestas
          </h1>
          <p className="text-white/40 text-sm mt-1 uppercase tracking-widest font-bold">Panel Administrativo de Kronix</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-3 bg-neon-cyan hover:bg-neon-cyan/90 text-black font-bold text-sm uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(0,245,255,0.2)] disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Mercado
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totales', value: betMarkets.length, color: 'text-white' },
          { label: 'Abiertos', value: betMarkets.filter(m => m.status === 'open').length, color: 'text-green-400' },
          { label: 'Cerrados', value: betMarkets.filter(m => m.status === 'closed').length, color: 'text-yellow-400' },
          { label: 'Resueltos', value: betMarkets.filter(m => m.status === 'resolved').length, color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-center">
            <p className={`font-orbitron font-black text-2xl ${stat.color}`}>{stat.value}</p>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <select
          value={filterTournament}
          onChange={e => setFilterTournament(e.target.value)}
          className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-sm text-white/80 outline-none focus:border-neon-cyan/50"
        >
          <option value="">Todos los torneos</option>
          {tournaments.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Markets Table */}
      <div className="bg-dark-card/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
        {filteredMarkets.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🪙</p>
            <p className="text-white/40 text-sm font-semibold uppercase tracking-widest">No hay mercados de apuestas aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-6 py-4 text-[10px] text-white/30 font-bold uppercase tracking-widest">Torneo / Pregunta</th>
                  <th className="text-left px-4 py-4 text-[10px] text-white/30 font-bold uppercase tracking-widest">Tipo</th>
                  <th className="text-left px-4 py-4 text-[10px] text-white/30 font-bold uppercase tracking-widest">Estado</th>
                  <th className="text-left px-4 py-4 text-[10px] text-white/30 font-bold uppercase tracking-widest">Opciones</th>
                  <th className="text-right px-6 py-4 text-[10px] text-white/30 font-bold uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredMarkets.map(market => (
                  <tr key={market.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-white text-sm leading-snug">{market.question}</p>
                      <p className="text-white/30 text-[11px] mt-0.5">{market.tournaments?.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">{market.market_type}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${STATUS_COLORS[market.status] || 'text-white/40'}`}>
                        {STATUS_LABELS[market.status] || market.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(market.options as any[] || []).slice(0, 3).map((opt: any) => (
                          <span key={opt.id} className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${market.winning_option_id === opt.id ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/5 text-white/50'}`}>
                            {opt.name} ({opt.odds}x)
                          </span>
                        ))}
                        {(market.options?.length || 0) > 3 && (
                          <span className="text-[10px] text-white/30">+{market.options.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {market.status === 'open' && (
                          <button
                            onClick={() => handleClose(market.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg transition-all disabled:opacity-50"
                          >
                            Cerrar
                          </button>
                        )}
                        {(market.status === 'open' || market.status === 'closed') && (
                          <button
                            onClick={() => setResolveModal({ market })}
                            disabled={isPending}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/20 rounded-lg transition-all disabled:opacity-50"
                          >
                            Resolver
                          </button>
                        )}
                        {market.status !== 'resolved' && market.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancel(market.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-[#0d0d1a] border border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <div>
                <h2 className="font-orbitron font-black text-lg text-white uppercase">Nuevo Mercado de Apuestas</h2>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mt-0.5">Kronix Betting Control</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Tournament */}
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Torneo *</label>
                <select
                  value={selectedTournamentId}
                  onChange={e => { setSelectedTournamentId(e.target.value); setSelectedMatchId('') }}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-cyan/50"
                >
                  <option value="">— Selecciona un torneo —</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Match (optional) */}
              {matchesForTournament.length > 0 && (
                <div>
                  <label className="block text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Partida (Opcional)</label>
                  <select
                    value={selectedMatchId}
                    onChange={e => setSelectedMatchId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-cyan/50"
                  >
                    <option value="">— Sin partida específica —</option>
                    {matchesForTournament.map(m => (
                      <option key={m.id} value={m.id}>{m.name} {m.is_completed ? '(Completada)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTournamentId && (
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                  <p className="text-[10px] text-white/50 uppercase tracking-widest font-black text-left">Plantillas Predeterminadas (Auto-Completado)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('top5_tournament')}
                      className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      🎖️ Top 5 General
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('top3_tournament')}
                      className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      🥉 Podio (Top 3)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('winner_tournament')}
                      className="p-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      👑 Campeón Torneo
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('top5_match')}
                      disabled={!selectedMatchId}
                      className="p-2.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      🎯 Top 5 Partida
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('winner_match')}
                      disabled={!selectedMatchId}
                      className="p-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      🏆 Ganador Partida
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('kills_tournament')}
                      className="p-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      🔫 Más Kills Torneo
                    </button>
                  </div>
                </div>
              )}

              {/* Market type */}
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Tipo de Mercado *</label>
                <div className="grid grid-cols-5 gap-2">
                  {(['winner', 'top_5', 'top_3', 'most_kills', 'custom'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMarketType(type)}
                      className={`py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all ${marketType === type ? 'bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan' : 'bg-white/[0.03] border-white/5 text-white/40 hover:text-white/70'}`}
                    >
                      {type === 'winner' ? '🏆 Ganador' : type === 'top_5' ? '🎖️ Top 5' : type === 'top_3' ? '🥉 Top 3' : type === 'most_kills' ? '💀 Kills' : '✏️ Custom'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question */}
              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2">Pregunta del Mercado *</label>
                <input
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ej: ¿Qué equipo ganará la Partida 1?"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50"
                />
              </div>

              {/* Options */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Opciones ({options.length})</label>
                  <div className="flex gap-2">
                    {selectedTournamentId && teamsForTournament.length > 0 && (
                      <button
                        onClick={handleAutofillTeams}
                        className="text-[10px] px-3 py-1.5 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/20 rounded-lg font-bold uppercase tracking-wider transition-all"
                      >
                        ⚡ Autocompletar con Equipos
                      </button>
                    )}
                    <button
                      onClick={handleAddOption}
                      className="text-[10px] px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-lg font-bold uppercase tracking-wider transition-all"
                    >
                      + Opción
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={opt.id} className="flex gap-2 items-center">
                      <span className="text-white/20 text-xs w-5 shrink-0 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        value={opt.name}
                        onChange={e => handleOptionChange(opt.id, 'name', e.target.value)}
                        placeholder="Nombre de la opción"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-neon-cyan/50"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        value={opt.odds}
                        onChange={e => handleOptionChange(opt.id, 'odds', e.target.value)}
                        className="w-20 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-neon-cyan outline-none focus:border-neon-cyan/50 font-mono text-center"
                        title="Cuota"
                      />
                      <span className="text-white/20 text-xs">x</span>
                      {options.length > 2 && (
                        <button onClick={() => handleRemoveOption(opt.id)} className="p-1.5 text-white/20 hover:text-red-400 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-white/5">
                <button
                  onClick={handleCreate}
                  disabled={isPending || !selectedTournamentId || !question.trim()}
                  className="flex-1 py-3 bg-neon-cyan hover:bg-neon-cyan/90 text-black font-bold text-sm uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Creando...' : 'Crear Mercado'}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); resetForm() }}
                  className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white/50 font-bold text-sm uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl"
          onClick={() => setResolveModal(null)}
        >
          <div
            className="bg-[#0d0d1a] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <div>
                <h2 className="font-orbitron font-black text-lg text-white uppercase">Resolver Mercado</h2>
                <p className="text-white/40 text-xs mt-0.5">Selecciona la opción ganadora</p>
              </div>
              <button onClick={() => setResolveModal(null)} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6">
              <p className="text-white/70 text-sm mb-5 font-semibold">{resolveModal.market.question}</p>
              <div className="space-y-2">
                {(resolveModal.market.options as any[]).map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => handleResolve(opt.id)}
                    disabled={isPending}
                    className="w-full flex items-center justify-between p-4 bg-white/[0.03] hover:bg-neon-cyan/10 border border-white/5 hover:border-neon-cyan/30 rounded-xl transition-all group disabled:opacity-50"
                  >
                    <span className="font-semibold text-white group-hover:text-neon-cyan transition-colors">{opt.name}</span>
                    <span className="font-orbitron font-bold text-neon-cyan text-sm">{opt.odds}x</span>
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest mt-4 text-center">
                ⚠️ Esta acción paga automáticamente a los ganadores y no se puede deshacer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

