'use client'

import React, { useState, useMemo } from 'react'
import { Orbitron } from 'next/font/google'
import type { TournamentAnalyticsSummary, AdAnalyticsSummary } from '@/lib/actions/analytics'

const orbitron = Orbitron({ subsets: ['latin'] })

interface AnalyticsClientProps {
  data: {
    global: {
      totalViews: number
      uniqueVisitors: number
      totalAdClicks: number
      averageViewsPerTournament: number
    }
    tournaments: TournamentAnalyticsSummary[]
    ads: AdAnalyticsSummary[]
    streamViewersHistory: {
      id: string
      tournamentId: string
      tournamentName: string
      viewerCount: number
      createdAt: string
    }[]
    rawEvents: any[]
  }
}

export function AnalyticsClient({ data }: AnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tournaments' | 'stream_viewers' | 'ads' | 'logs'>('overview')
  const [searchTerm, setSearchTerm] = useState('')

  // Filtered tournaments
  const filteredTournaments = useMemo(() => {
    return data.tournaments.filter(t =>
      t.tournamentName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data.tournaments, searchTerm])

  // CSV Exporter Utility
  const exportToCSV = (type: 'tournaments' | 'ads' | 'streams') => {
    let headers: string[] = []
    let rows: string[][] = []
    let filename = ''

    if (type === 'tournaments') {
      headers = ['ID de Torneo', 'Nombre del Torneo', 'Vistas Totales', 'Visitantes Únicos', 'Clics en Patrocinadores', 'Espectadores Promedio', 'Pico de Espectadores']
      rows = data.tournaments.map(t => [
        t.tournamentId,
        t.tournamentName,
        t.totalViews.toString(),
        t.uniqueVisitors.toString(),
        t.totalAdClicks.toString(),
        (t.averageViewers ?? 0).toString(),
        (t.peakViewers ?? 0).toString()
      ])
      filename = `reporte_torneos_${new Date().toISOString().split('T')[0]}.csv`
    } else if (type === 'ads') {
      headers = ['Espacio publicitario', 'Patrocinador', 'Clics totales', 'URL Destino']
      rows = data.ads.map(ad => [
        ad.slotName,
        ad.advertiserName,
        ad.totalClicks.toString(),
        ad.clickThroughUrl
      ])
      filename = `reporte_publicidad_${new Date().toISOString().split('T')[0]}.csv`
    } else {
      headers = ['Fecha/Hora', 'Torneo', 'Espectadores en Vivo']
      rows = (data.streamViewersHistory || []).map(sh => [
        new Date(sh.createdAt).toLocaleString('es'),
        sh.tournamentName,
        sh.viewerCount.toString()
      ])
      filename = `reporte_espectadores_streams_${new Date().toISOString().split('T')[0]}.csv`
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Calculate stats to find the highest values for bar charts
  const maxViews = useMemo(() => {
    return Math.max(...data.tournaments.map(t => t.totalViews), 1)
  }, [data.tournaments])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`${orbitron.className} text-2xl sm:text-3xl font-black text-white uppercase tracking-widest`}>
            Métricas de Tráfico y Publicidad
          </h1>
          <p className="text-white/40 text-sm mt-1">Monitorea visitas, puntos calientes y rendimiento de patrocinadores</p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => exportToCSV('tournaments')}
            className="px-4 py-2 bg-neon-cyan text-black font-black text-xs uppercase tracking-wider rounded-lg hover:shadow-[0_0_15px_rgba(0,245,255,0.3)] transition-all flex items-center gap-2"
          >
            📊 Exportar Torneos (CSV)
          </button>
          <button
            onClick={() => exportToCSV('streams')}
            className="px-4 py-2 bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-lg hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all flex items-center gap-2"
          >
            📺 Exportar Streams (CSV)
          </button>
          <button
            onClick={() => exportToCSV('ads')}
            className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 font-bold text-xs uppercase tracking-wider rounded-lg transition-all"
          >
            📢 Exportar Ads (CSV)
          </button>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/5 blur-2xl rounded-full" />
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Vistas de Página Totales</p>
          <p className="text-3xl font-black text-white mt-3 font-orbitron">{data.global.totalViews.toLocaleString()}</p>
          <p className="text-[10px] text-white/30 mt-1">Tráfico total acumulado en tableros</p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-2xl rounded-full" />
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Visitantes Únicos</p>
          <p className="text-3xl font-black text-purple-400 mt-3 font-orbitron">{data.global.uniqueVisitors.toLocaleString()}</p>
          <p className="text-[10px] text-white/30 mt-1">Usuarios únicos registrados por ID</p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 blur-2xl rounded-full" />
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Clics en Patrocinadores</p>
          <p className="text-3xl font-black text-green-400 mt-3 font-orbitron">{data.global.totalAdClicks.toLocaleString()}</p>
          <p className="text-[10px] text-white/30 mt-1">Clics acumulados en banners laterales</p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 blur-2xl rounded-full" />
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Promedio Vistas/Torneo</p>
          <p className="text-3xl font-black text-yellow-400 mt-3 font-orbitron">{data.global.averageViewsPerTournament.toLocaleString()}</p>
          <p className="text-[10px] text-white/30 mt-1">Vistas promedio por landing page</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'overview' ? 'border-neon-cyan text-white' : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          Visión General
        </button>
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'tournaments' ? 'border-neon-cyan text-white' : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          Torneos y Tráfico
        </button>
        <button
          onClick={() => setActiveTab('stream_viewers')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'stream_viewers' ? 'border-neon-cyan text-white' : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          Espectadores de Streams
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'ads' ? 'border-neon-cyan text-white' : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          Patrocinadores (Clics)
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'logs' ? 'border-neon-cyan text-white' : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          Registro de Eventos
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Top Tournaments Chart */}
          <div className="lg:col-span-7 bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="text-white font-bold text-base">Torneos Más Visitados</h3>
              <p className="text-white/40 text-xs mt-0.5">Ranking de los torneos con mayor impacto de tráfico</p>
            </div>

            <div className="space-y-4">
              {data.tournaments.slice(0, 5).map((t, idx) => {
                const percent = Math.round((t.totalViews / maxViews) * 100)
                return (
                  <div key={t.tournamentId} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-white/80">
                      <span>{idx + 1}. {t.tournamentName}</span>
                      <span>{t.totalViews.toLocaleString()} visitas ({t.uniqueVisitors.toLocaleString()} únicos)</span>
                    </div>
                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-neon-cyan via-purple-500 to-transparent rounded-full transition-all duration-1000"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {data.tournaments.length === 0 && (
                <p className="text-center py-12 text-white/20 text-sm italic">Aún no hay datos de visitas registrados</p>
              )}
            </div>
          </div>

          {/* Ad stats sidebar */}
          <div className="lg:col-span-5 bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="text-white font-bold text-base">Impacto de Patrocinadores</h3>
              <p className="text-white/40 text-xs mt-0.5">Clics y conversiones de banners dinámicos</p>
            </div>

            <div className="space-y-4 divide-y divide-white/5">
              {data.ads.slice(0, 4).map((ad, idx) => (
                <div key={`${ad.slotName}-${ad.advertiserName}`} className="pt-3 first:pt-0 flex justify-between items-center">
                  <div>
                    <span className="text-xs bg-neon-cyan/15 text-neon-cyan px-2 py-0.5 rounded font-black uppercase tracking-wider text-[9px]">
                      {ad.slotName}
                    </span>
                    <h4 className="text-white text-sm font-semibold mt-1">{ad.advertiserName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="font-orbitron font-black text-green-400 text-lg">{ad.totalClicks}</span>
                    <span className="text-[9px] text-white/30 uppercase block font-bold">Clics</span>
                  </div>
                </div>
              ))}
              {data.ads.length === 0 && (
                <p className="text-center py-12 text-white/20 text-sm italic">Sin clics registrados en publicidad</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tournaments' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-bold text-lg">Métricas Detalladas por Torneo</h3>
              <p className="text-white/40 text-xs mt-0.5">Métricas de impacto y engagement por torneos creados</p>
            </div>
            
            <input
              type="text"
              placeholder="Buscar torneo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-neon-cyan transition-colors"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-black">
                  <th className="py-3 px-4">Torneo</th>
                  <th className="py-3 px-4 text-center">Vistas Totales</th>
                  <th className="py-3 px-4 text-center">Visitantes Únicos</th>
                  <th className="py-3 px-4 text-center">Clics en Ads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTournaments.map(t => (
                  <tr key={t.tournamentId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-bold text-white text-sm">{t.tournamentName}</td>
                    <td className="py-4 px-4 text-center font-orbitron text-sm text-neon-cyan font-bold">{t.totalViews.toLocaleString()}</td>
                    <td className="py-4 px-4 text-center font-orbitron text-sm text-purple-400 font-bold">{t.uniqueVisitors.toLocaleString()}</td>
                    <td className="py-4 px-4 text-center font-orbitron text-sm text-green-400 font-bold">{t.totalAdClicks.toLocaleString()}</td>
                  </tr>
                ))}
                {filteredTournaments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-white/30 italic">No se encontraron torneos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ads' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden p-6 space-y-4">
          <div>
            <h3 className="text-white font-bold text-lg">Estadísticas de Publicidad</h3>
            <p className="text-white/40 text-xs mt-0.5">Control de rendimiento de campañas y banners para patrocinadores</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-black">
                  <th className="py-3 px-4">Patrocinador</th>
                  <th className="py-3 px-4">Ubicación (Slot)</th>
                  <th className="py-3 px-4 text-center">Clics Registrados</th>
                  <th className="py-3 px-4">URL de Destino</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.ads.map(ad => (
                  <tr key={`${ad.slotName}-${ad.advertiserName}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-bold text-white text-sm">{ad.advertiserName}</td>
                    <td className="py-4 px-4">
                      <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white/60">
                        {ad.slotName}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center font-orbitron text-green-400 font-black text-sm">{ad.totalClicks}</td>
                    <td className="py-4 px-4 text-white/50 truncate max-w-xs" title={ad.clickThroughUrl}>
                      {ad.clickThroughUrl ? (
                        <a href={ad.clickThroughUrl} target="_blank" rel="noreferrer" className="hover:underline hover:text-neon-cyan">
                          {ad.clickThroughUrl}
                        </a>
                      ) : (
                        <span className="text-white/20 italic">Sin enlace directo</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.ads.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-white/30 italic">No hay clics en banners registrados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'stream_viewers' && (
        <div className="space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-neon-cyan/5 blur-2xl rounded-full" />
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Pico de Espectadores Histórico</p>
              <p className="text-3xl font-black text-neon-cyan mt-3 font-orbitron">
                {Math.max(...data.tournaments.map(t => t.peakViewers ?? 0), 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-white/30 mt-1">Pico máximo registrado en streams concurrentes</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-2xl rounded-full" />
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Promedio General de Espectadores</p>
              <p className="text-3xl font-black text-purple-400 mt-3 font-orbitron">
                {data.tournaments.length > 0 
                  ? Math.round(data.tournaments.reduce((acc, t) => acc + (t.averageViewers ?? 0), 0) / data.tournaments.length).toLocaleString()
                  : 0
                }
              </p>
              <p className="text-[10px] text-white/30 mt-1">Promedio de espectadores en vivo por torneo</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 blur-2xl rounded-full" />
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Muestras de Tráfico Registradas</p>
              <p className="text-3xl font-black text-yellow-400 mt-3 font-orbitron">
                {(data.streamViewersHistory || []).length}
              </p>
              <p className="text-[10px] text-white/30 mt-1">Total de snapshots capturados en tiempo real</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Viewers by Tournament Table */}
            <div className="lg:col-span-6 bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Espectadores por Torneo</h3>
                <p className="text-white/40 text-xs mt-0.5">Métricas de streaming en vivo por torneo activo</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-black">
                      <th className="py-3 px-2">Torneo</th>
                      <th className="py-3 px-2 text-center">Promedio</th>
                      <th className="py-3 px-2 text-center">Pico Máximo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTournaments.map(t => (
                      <tr key={t.tournamentId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-2 font-bold text-white text-xs">{t.tournamentName}</td>
                        <td className="py-3 px-2 text-center font-orbitron text-purple-400 font-bold">{(t.averageViewers ?? 0).toLocaleString()}</td>
                        <td className="py-3 px-2 text-center font-orbitron text-neon-cyan font-bold">{(t.peakViewers ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {filteredTournaments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-white/30 italic">No hay torneos registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Snapshots History Timeline */}
            <div className="lg:col-span-6 bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-bold text-base">Historial de Capturas de Tráfico (Snapshots)</h3>
                <p className="text-white/40 text-xs mt-0.5">Capturas automáticas de espectadores concurrentes</p>
              </div>

              <div className="overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-white/10 pr-2">
                <div className="space-y-4">
                  {(data.streamViewersHistory || []).map((sh) => (
                    <div key={sh.id} className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-white/40">{new Date(sh.createdAt).toLocaleString('es')}</p>
                        <p className="text-xs font-bold text-white">{sh.tournamentName}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-orbitron font-black text-neon-cyan text-sm">{sh.viewerCount.toLocaleString()}</span>
                        <span className="text-[8px] text-white/30 uppercase block font-bold">Espectadores</span>
                      </div>
                    </div>
                  ))}
                  {(data.streamViewersHistory || []).length === 0 && (
                    <p className="text-center py-12 text-white/20 text-sm italic">Sin capturas de espectadores registradas aún</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden p-6 space-y-4">
          <div>
            <h3 className="text-white font-bold text-lg">Registro Reciente de Eventos</h3>
            <p className="text-white/40 text-xs mt-0.5">Últimas 100 interacciones en tiempo real procesadas por la plataforma</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="border-b border-white/5 text-white/40 uppercase tracking-widest font-black">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Tipo de Evento</th>
                  <th className="py-3 px-4">Ruta (Path)</th>
                  <th className="py-3 px-4">ID de Sesión / Dispositivo</th>
                  <th className="py-3 px-4">Metadatos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/60">
                {data.rawEvents.map(event => (
                  <tr key={event.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-white/40">
                      {new Date(event.created_at).toLocaleString('es')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        event.event_type === 'page_view'
                          ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                          : 'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {event.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 truncate max-w-xs">{event.path}</td>
                    <td className="py-3 px-4 truncate max-w-[120px]" title={event.visitor_id}>
                      {event.visitor_id.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-4 text-[10px] text-white/30 truncate max-w-xs" title={JSON.stringify(event.metadata)}>
                      {JSON.stringify(event.metadata)}
                    </td>
                  </tr>
                ))}
                {data.rawEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-white/30 italic">No hay logs de eventos disponibles</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
