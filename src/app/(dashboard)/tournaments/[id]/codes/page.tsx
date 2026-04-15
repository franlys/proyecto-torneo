import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardStreamerCodeManager } from './DashboardStreamerCodeManager'

export default async function TournamentCodesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Verificar que el usuario tiene acceso al torneo
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = await isAdmin()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, creator_id, status')
    .eq('id', id)
    .single()

  if (!tournament) notFound()

  // Solo el creador o un admin puede gestionar códigos
  if (!admin && tournament.creator_id !== user.id) redirect('/tournaments')

  const { data: codes } = await supabase
    .from('streamer_codes')
    .select('*')
    .eq('tournament_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/tournaments/${id}`}
          className="text-white/40 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Códigos de Streamer</h1>
          <p className="text-white/40 text-sm">{tournament.name}</p>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl p-4 text-sm text-white/50 space-y-1">
        <p className="text-neon-cyan font-semibold text-xs uppercase tracking-widest">¿Para qué sirven?</p>
        <p>
          Cada código identifica a un streamer en ArenaCrypto. Cuando sus viewers
          usan su código para apostar, las ganancias generadas cuentan como ingresos de Kronix.
        </p>
      </div>

      <DashboardStreamerCodeManager tournamentId={id} initialCodes={codes ?? []} />
    </div>
  )
}
