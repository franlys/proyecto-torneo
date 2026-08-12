import React from 'react'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { TabLinks } from './TabLinks'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TournamentDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const adminSupabase = await createAdminClient()

  // Fetch basic tournament info to populate header and check if betting is enabled
  const { data: tournament } = await adminSupabase
    .from('tournaments')
    .select('id, name, slug, arena_betting_enabled, status')
    .eq('id', params.id)
    .single()

  if (!tournament) redirect('/tournaments')

  const tabs = [
    { name: 'Resumen', path: `/tournaments/${params.id}` },
    { name: 'Ajustes', path: `/tournaments/${params.id}/edit` },
    { name: 'Participantes', path: `/tournaments/${params.id}/participants` },
    { name: 'Partidas', path: `/tournaments/${params.id}/matches` },
    { name: 'Evidencias', path: `/tournaments/${params.id}/submissions` },
    { name: 'Personalizar', path: `/tournaments/${params.id}/customize` },
    { name: 'Códigos', path: `/tournaments/${params.id}/codes` },
  ]

  if (tournament.arena_betting_enabled) {
    tabs.push({ name: 'Apuestas', path: `/tournaments/${params.id}/bets` })
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 text-left">
      {/* Tournament Dashboard Control Panel Header */}
      <div className="bg-[#0f0f1b]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 relative overflow-visible shadow-2xl">
        <div className="space-y-1.5 shrink-0">
          <Link
            href="/tournaments"
            className="text-[10px] font-bold text-white/40 hover:text-neon-cyan uppercase tracking-widest transition-colors inline-flex items-center gap-1.5"
          >
            ← Volver a Mis Torneos
          </Link>
          <h1 className="font-orbitron text-xl sm:text-2xl font-black text-white uppercase tracking-tight truncate max-w-[320px] sm:max-w-md">
            {tournament.name}
          </h1>
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
            Panel de Control del Organizador
          </p>
        </div>

        {/* Tab navigation bar */}
        <div className="w-full lg:w-auto overflow-hidden">
          <TabLinks tabs={tabs} />
        </div>
      </div>

      {/* Page Content Card Wrapper */}
      <div className="bg-[#0b0b14]/40 border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl min-h-[50vh]">
        {children}
      </div>
    </div>
  )
}
