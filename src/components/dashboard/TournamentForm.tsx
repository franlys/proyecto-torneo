'use client'

import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createTournamentSchema, type CreateTournamentInput } from '@/lib/validations/schemas'
import { createTournament } from '@/lib/actions/tournaments'
import { ScoringRuleEditor } from './ScoringRuleEditor'

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-0.5 h-full min-h-[2.5rem] bg-gradient-to-b from-neon-cyan to-neon-purple rounded-full shrink-0 mt-0.5" />
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Mode cards ──────────────────────────────────────────────────────────────

const MODES = [
  { value: 'individual', label: 'Individual', icon: '👤', desc: '1 jugador' },
  { value: 'duos', label: 'Duos', icon: '👥', desc: '2 jugadores' },
  { value: 'trios', label: 'Tríos', icon: '🎮', desc: '3 jugadores' },
  { value: 'cuartetos', label: 'Cuartetos', icon: '🏆', desc: '4 jugadores' },
] as const

const FORMATS = [
  {
    value: 'battle_royale_clasico',
    label: 'Battle Royale',
    desc: 'Puntos por posición + kills acumulados',
  },
  {
    value: 'kill_race',
    label: 'Kill Race',
    desc: 'Ranking por kills en tiempo límite',
  },
  {
    value: 'custom_rooms',
    label: 'Custom Rooms',
    desc: 'Salas privadas con reglas personalizadas',
  },
  {
    value: 'eliminacion_directa',
    label: 'Eliminación Directa',
    desc: 'Bracket de eliminación por rondas',
  },
  {
    value: 'fase_de_grupos',
    label: 'Fase de Grupos',
    desc: 'Grupos con clasificación a siguiente fase',
  },
] as const

// ─── Main form ───────────────────────────────────────────────────────────────

interface TournamentFormProps {
  onSuccess?: (id: string) => void
}

export function TournamentForm({ onSuccess }: TournamentFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const methods = useForm<CreateTournamentInput>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: {
      killRateEnabled: true,
      potTopEnabled: true,
      vipEnabled: false,
      tiebreakerMatchEnabled: false,
      scoringRule: {
        killPoints: 1,
        placementPoints: { '1': 15, '2': 12, '3': 10, '4': 8, '5': 6, '6': 4, '7': 2, '8': 1 },
      },
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = methods

  const level = watch('level')
  const format = watch('format')
  const mode = watch('mode')
  const rulesText = watch('rulesText') ?? ''

  const maxMatches = level === 'casual' ? 3 : level === 'profesional' ? 12 : undefined
  const minMatches = level === 'profesional' ? 6 : 1

  async function onSubmit(data: CreateTournamentInput) {
    setServerError(null)
    const result = await createTournament(data)
    if ('error' in result) {
      setServerError(result.error)
      return
    }
    if (onSuccess) {
      onSuccess(result.data.id)
    } else {
      router.push(`/tournaments/${result.data.id}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = (msg: any) => typeof msg === 'string' ? <p className="text-red-400 text-xs mt-1">{msg}</p> : null

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 ' +
    'focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none transition-all duration-150'

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">

        {/* ── Section 1: Información básica ── */}
        <section>
          <SectionHeader title="Información básica" subtitle="Nombre, descripción y fechas del torneo" />
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Nombre del torneo *
              </label>
              <input
                {...register('name')}
                placeholder="Ej: Torneo Verano 2025"
                className={`${inputClass} text-base font-medium`}
              />
              {err(errors.name?.message)}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Descripción
              </label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Describe brevemente el torneo..."
                className={`${inputClass} resize-none`}
              />
              {err(errors.description?.message)}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  {...register('startDate')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Fecha de fin
                </label>
                <input
                  type="date"
                  {...register('endDate')}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: Configuración ── */}
        <section>
          <SectionHeader title="Configuración" subtitle="Modalidad, formato y nivel de competencia" />
          <div className="space-y-6">

            {/* Tournament Mode */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                Modalidad *
              </label>
              <div className="grid grid-cols-4 gap-3">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setValue('mode', m.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-150
                      ${mode === m.value
                        ? 'border-neon-cyan bg-neon-cyan/10 text-white'
                        : 'border-transparent bg-white/5 text-white/50 hover:border-neon-purple/50 hover:text-white/80'
                      }`}
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-xs opacity-60">{m.desc}</span>
                  </button>
                ))}
              </div>
              {err(errors.mode?.message)}
            </div>

            {/* Competition Format */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                Formato de competencia *
              </label>
              <div className="grid grid-cols-1 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setValue('format', f.value)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150
                      ${format === f.value
                        ? 'border-neon-cyan bg-neon-cyan/10'
                        : 'border-transparent bg-white/5 hover:border-neon-purple/50'
                      }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-150
                        ${format === f.value ? 'bg-neon-cyan' : 'bg-white/20'}`}
                    />
                    <div>
                      <p className={`text-sm font-medium transition-colors duration-150
                        ${format === f.value ? 'text-white' : 'text-white/60'}`}>
                        {f.label}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              {err(errors.format?.message)}
            </div>

            {/* Tournament Level */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                Nivel *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: 'casual',
                    label: 'Casual',
                    desc: 'Hasta 3 partidas · Sin verificación obligatoria',
                  },
                  {
                    value: 'profesional',
                    label: 'Profesional',
                    desc: '6–12 partidas · Verificación de evidencias requerida',
                  },
                ].map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setValue('level', l.value as 'casual' | 'profesional')}
                    className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all duration-150
                      ${level === l.value
                        ? 'border-neon-purple bg-neon-purple/10'
                        : 'border-transparent bg-white/5 hover:border-neon-purple/30'
                      }`}
                  >
                    <span className={`text-sm font-semibold transition-colors duration-150
                      ${level === l.value ? 'text-neon-purple' : 'text-white/60'}`}>
                      {l.label}
                    </span>
                    <span className="text-xs text-white/30">{l.desc}</span>
                  </button>
                ))}
              </div>
              {err(errors.level?.message)}
            </div>

            {/* Total Matches */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Total de partidas *
                {level === 'casual' && (
                  <span className="ml-2 text-white/30 normal-case font-normal">(máx. 3)</span>
                )}
                {level === 'profesional' && (
                  <span className="ml-2 text-white/30 normal-case font-normal">(6–12)</span>
                )}
              </label>
              <input
                type="number"
                min={minMatches}
                max={maxMatches}
                {...register('totalMatches', { valueAsNumber: true })}
                className="w-32 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                  focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                  transition-all duration-150"
              />
              {err(errors.totalMatches?.message)}
            </div>

            {/* Rounds per Match */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Rondas por Partida *
                <span className="ml-2 text-white/30 normal-case font-normal">(Ej: 3 para BO3)</span>
              </label>
              <input
                type="number"
                min={1}
                max={5}
                {...register('defaultRoundsPerMatch', { valueAsNumber: true })}
                className="w-32 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                  focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                  transition-all duration-150"
              />
              {err(errors.defaultRoundsPerMatch?.message)}
            </div>

            {/* Kill Race Time Limit */}
            {format === 'kill_race' && (
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                  Límite de tiempo Kill Race (minutos) *
                </label>
                <input
                  type="number"
                  min={1}
                  {...register('killRaceTimeLimitMinutes', { valueAsNumber: true })}
                  placeholder="Ej: 30"
                  className="w-40 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                    focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                    transition-all duration-150"
                />
                {err(errors.killRaceTimeLimitMinutes?.message)}
              </div>
            )}
          </div>
        </section>

        {/* ── Section 3: Métricas ── */}
        <section>
          <SectionHeader title="Métricas" subtitle="Activa las métricas que se mostrarán en el leaderboard" />
          <div className="space-y-3">
            {[
              {
                field: 'killRateEnabled' as const,
                label: 'Kill Rate',
                desc: 'Promedio de kills por partida',
              },
              {
                field: 'potTopEnabled' as const,
                label: 'Pot Top',
                desc: 'Veces que el equipo terminó en el top',
              },
              {
                field: 'vipEnabled' as const,
                label: 'Top Fragger (MVP)',
                desc: 'Métrica especial para destacar al mejor jugador del equipo',
              },
              {
                field: 'tiebreakerMatchEnabled' as const,
                label: 'Partida de desempate',
                desc: 'Permite programar una partida extra en caso de empate',
              },
            ].map(({ field, label, desc }) => {
              const value = watch(field)
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => setValue(field, !value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150
                    ${value
                      ? 'border-neon-cyan/30 bg-neon-cyan/5'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                    }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-medium transition-colors duration-150
                      ${value ? 'text-white' : 'text-white/50'}`}>
                      {label}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">{desc}</p>
                  </div>
                  {/* Toggle pill */}
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors duration-150 shrink-0
                      ${value ? 'bg-neon-cyan' : 'bg-white/10'}`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150
                        ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Section 4: Scoring Rule ── */}
        <section>
          <SectionHeader
            title="Sistema de puntuación"
            subtitle="Define los puntos por kill y por posición de llegada"
          />
          <ScoringRuleEditor />
        </section>

        {/* ── Section 5: Rules text ── */}
        <section>
          <SectionHeader title="Reglamento" subtitle="Texto libre con las reglas del torneo (visible al público)" />
          <div>
            <textarea
              {...register('rulesText')}
              rows={8}
              placeholder="Escribe aquí las reglas del torneo..."
              className={`${inputClass} resize-none`}
            />
            <div className="flex justify-between mt-1.5">
              {errors.rulesText ? (
                <p className="text-red-400 text-xs">{typeof errors.rulesText?.message === 'string' ? errors.rulesText.message : ''}</p>
              ) : (
                <span />
              )}
              <span
                className={`text-xs tabular-nums ${
                  rulesText.length > 4800 ? 'text-red-400' : 'text-white/25'
                }`}
              >
                {rulesText.length} / 5000
              </span>
            </div>
          </div>
        </section>

        {/* ── Server error ── */}
        {serverError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {serverError}
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 rounded-xl font-semibold text-sm text-white
              bg-gradient-to-r from-neon-cyan to-neon-purple
              hover:opacity-90 active:scale-[0.97]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-150 shadow-lg shadow-neon-cyan/10"
          >
            {isSubmitting ? 'Creando torneo...' : 'Crear torneo'}
          </button>
        </div>
      </form>
    </FormProvider>
  )
}
