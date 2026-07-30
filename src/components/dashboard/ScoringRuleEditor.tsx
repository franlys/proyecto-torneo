'use client'

import { useState, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import type { CreateTournamentInput } from '@/lib/validations/schemas'

// Presets de SUMA de puntos (modo estándar)
const STANDARD_PRESETS = {
  battle_royale: {
    label: 'Battle Royale BR (8 pos.)',
    points: { '1': 15, '2': 12, '3': 10, '4': 8, '5': 6, '6': 4, '7': 2, '8': 1 },
    useMultiplier: false,
  },
  br_top5: {
    label: 'Solo Top 5',
    points: { '1': 10, '2': 7, '3': 5, '4': 3, '5': 1 },
    useMultiplier: false,
  },
  kill_race: {
    label: 'Kill Race (solo kills)',
    points: { '1': 0, '2': 0, '3': 0, '4': 0 },
    useMultiplier: false,
  },
  custom_standard: {
    label: 'Personalizado (vacío)',
    points: {},
    useMultiplier: false,
  },
} as const

// Presets de MULTIPLICADOR por posición (WSOW / Apex Legends style)
const MULTIPLIER_PRESETS = {
  wsow_top15: {
    label: 'WSOW Top 15',
    points: {
      '1': 2.0, '2': 1.5, '3': 1.5, '4': 1.5, '5': 1.5,
      '6': 1.25, '7': 1.25, '8': 1.25, '9': 1.25, '10': 1.25,
      '11': 1.25, '12': 1.25, '13': 1.25, '14': 1.25, '15': 1.25
    },
    useMultiplier: true,
  },
  apex_top10: {
    label: 'Apex / BR Top 10',
    points: {
      '1': 2.0, '2': 1.8, '3': 1.6, '4': 1.4, '5': 1.2,
      '6': 1.1, '7': 1.1, '8': 1.05, '9': 1.05, '10': 1.0
    },
    useMultiplier: true,
  },
  top5_multiplier: {
    label: 'Solo Top 5',
    points: { '1': 2.0, '2': 1.5, '3': 1.25, '4': 1.1, '5': 1.0 },
    useMultiplier: true,
  },
  custom_multiplier: {
    label: 'Personalizado (vacío)',
    points: {},
    useMultiplier: true,
  },
} as const

type StandardPresetKey = keyof typeof STANDARD_PRESETS
type MultiplierPresetKey = keyof typeof MULTIPLIER_PRESETS

export function ScoringRuleEditor() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreateTournamentInput>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const killPoints = watch('scoringRule.killPoints') ?? 1
  const placementPoints = watch('scoringRule.placementPoints') ?? {}
  const useMultiplier = watch('scoringRule.useMultiplier') ?? false
  const format = watch('format')

  // Efecto para autoseleccionar si es Kill Race
  useEffect(() => {
    if (format === 'kill_race' && activePreset !== 'kill_race') {
      applyStandardPreset('kill_race');
    }
  }, [format])

  // Convert record to sorted array for display
  const rows = Object.entries(placementPoints as Record<string, number>)
    .map(([pos, pts]) => ({ pos: Number(pos), pts: Number(pts) }))
    .sort((a, b) => a.pos - b.pos)

  // Force clean helper para evitar bugs visuales de React
  const applyPresetSafe = (updateFn: () => void, presetId: string) => {
    // Primero forzamos la limpieza completa del objeto
    setValue('scoringRule.placementPoints', {});
    setActivePreset(presetId)
    // En el siguiente ciclo de renderizado, aplicamos los nuevos valores
    setTimeout(() => {
      updateFn();
    }, 10)
  }

  function applyStandardPreset(key: StandardPresetKey) {
    applyPresetSafe(() => {
      setValue('scoringRule.placementPoints', STANDARD_PRESETS[key].points as Record<string, number>)
      setValue('scoringRule.useMultiplier', false)
    }, key)
  }

  function applyMultiplierPreset(key: MultiplierPresetKey) {
    applyPresetSafe(() => {
      setValue('scoringRule.placementPoints', MULTIPLIER_PRESETS[key].points as Record<string, number>)
      setValue('scoringRule.useMultiplier', true)
    }, key)
  }

  function addRow() {
    const nextPos = rows.length > 0 ? Math.max(...rows.map((r) => r.pos)) + 1 : 1
    setValue('scoringRule.placementPoints', {
      ...placementPoints,
      [String(nextPos)]: useMultiplier ? 1.0 : 0,
    })
    setActivePreset('custom')
  }

  function removeRow(pos: number) {
    const updated = { ...placementPoints }
    delete updated[String(pos)]
    setValue('scoringRule.placementPoints', updated)
    setActivePreset('custom')
  }

  function updateRow(oldPos: number, newPos: number, pts: number) {
    const updated = { ...placementPoints }
    delete updated[String(oldPos)]
    updated[String(newPos)] = pts
    setValue('scoringRule.placementPoints', updated)
    setActivePreset('custom')
  }

  // Preview calculation
  const firstPos = rows[0]
  const previewPlacementValue = firstPos ? Number(firstPos.pts) : (useMultiplier ? 1.0 : 0)
  const previewKills = 5
  const previewTotal = useMultiplier
    ? (previewKills * killPoints) * previewPlacementValue
    : previewPlacementValue + killPoints * previewKills

  return (
    <div className="space-y-6">
      {/* Selector Rápido (Tarjetas) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => applyMultiplierPreset('wsow_top15')}
          className={`p-4 rounded-xl border text-left transition-all ${activePreset === 'wsow_top15' ? 'bg-neon-cyan/10 border-neon-cyan shadow-[0_0_15px_rgba(0,245,255,0.2)]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
        >
          <p className="text-xs font-bold text-neon-cyan uppercase tracking-widest mb-1">WSOW / Pro</p>
          <p className="text-sm text-white font-medium">Multiplicador por Puesto (Top 15)</p>
          <p className="text-xs text-white/40 mt-2">Recomendado para torneos profesionales de Warzone.</p>
        </button>

        <button
          type="button"
          onClick={() => applyStandardPreset('battle_royale')}
          className={`p-4 rounded-xl border text-left transition-all ${activePreset === 'battle_royale' ? 'bg-neon-purple/10 border-neon-purple shadow-[0_0_15px_rgba(184,41,255,0.2)]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
        >
          <p className="text-xs font-bold text-neon-purple uppercase tracking-widest mb-1">Estándar BR</p>
          <p className="text-sm text-white font-medium">Suma de Puntos (Top 8)</p>
          <p className="text-xs text-white/40 mt-2">Ideal para Battle Royales clásicos y torneos casuales.</p>
        </button>

        <button
          type="button"
          onClick={() => { setActivePreset('custom'); setShowAdvanced(true); }}
          className={`p-4 rounded-xl border text-left transition-all ${activePreset === 'custom' ? 'bg-white/10 border-white/40' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
        >
          <p className="text-xs font-bold text-white uppercase tracking-widest mb-1">Personalizado</p>
          <p className="text-sm text-white font-medium">Configuración Manual</p>
          <p className="text-xs text-white/40 mt-2">Abre el editor completo para editar puntos exactos.</p>
        </button>
      </div>

      <div className="flex justify-between items-center px-2">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors flex items-center gap-2 font-bold"
        >
          {showAdvanced ? '▼ Ocultar Configuración Avanzada' : '▶ Mostrar Configuración Avanzada'}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-5 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Scoring Type Selection */}
          <div>
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
              Modo de Puntuación
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue('scoringRule.useMultiplier', false)
                  const resetPoints = { ...placementPoints }
                  Object.keys(resetPoints).forEach(key => {
                    resetPoints[key] = Math.round(resetPoints[key])
                  })
                  setValue('scoringRule.placementPoints', resetPoints)
                  setActivePreset('custom')
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 ${
                  !useMultiplier
                    ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white/80'
                }`}
              >
                Suma de puntos (Estándar)
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('scoringRule.useMultiplier', true)
                  const resetPoints = { ...placementPoints }
                  Object.keys(resetPoints).forEach(key => {
                    if (resetPoints[key] === 0) resetPoints[key] = 1.0
                  })
                  setValue('scoringRule.placementPoints', resetPoints)
                  setActivePreset('custom')
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 ${
                  useMultiplier
                    ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white/80'
                }`}
              >
                Multiplicador por puesto (Shooters / WSOW)
              </button>
            </div>
          </div>

          {/* Kill Points */}
          <div>
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
              Puntos por Kill
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              {...register('scoringRule.killPoints', { valueAsNumber: true })}
              className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm
                focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 focus:outline-none
                transition-all duration-150"
            />
            {errors.scoringRule && 'killPoints' in errors.scoringRule && errors.scoringRule.killPoints && (
              <p className="text-red-400 text-xs mt-1">{String(errors.scoringRule.killPoints.message)}</p>
            )}
          </div>

          {/* Placement Points/Multipliers Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                {useMultiplier ? 'Multiplicador por Posición' : 'Puntos por Posición'}
              </label>
              {/* Preset buttons - solo los del modo activo */}
              <div className="flex flex-wrap gap-2">
                {!useMultiplier
                  ? (Object.keys(STANDARD_PRESETS) as StandardPresetKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyStandardPreset(key)}
                      className="px-2.5 py-1 rounded text-xs text-white/50 border border-white/10
                        hover:border-neon-cyan/40 hover:text-white/80 transition-all duration-150"
                    >
                      {STANDARD_PRESETS[key].label}
                    </button>
                  ))
                  : (Object.keys(MULTIPLIER_PRESETS) as MultiplierPresetKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyMultiplierPreset(key)}
                      className="px-2.5 py-1 rounded text-xs text-white/50 border border-white/10
                        hover:border-neon-purple/40 hover:text-white/80 transition-all duration-150"
                    >
                      {MULTIPLIER_PRESETS[key].label}
                    </button>
                  ))
                }
              </div>
            </div>

            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase tracking-wider">
                      Posición
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-white/40 uppercase tracking-wider">
                      {useMultiplier ? 'Multiplicador (x)' : 'Puntos'}
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-white/30 text-xs">
                        Sin posiciones configuradas. Agrega una o usa un preset.
                      </td>
                    </tr>
                  )}
                  {rows.map(({ pos, pts }) => (
                    <ScoringRow 
                      key={pos} 
                      initialPos={pos} 
                      initialPts={pts} 
                      useMultiplier={useMultiplier} 
                      onUpdate={updateRow} 
                      onRemove={removeRow} 
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-xs text-neon-cyan/70 hover:text-neon-cyan
                transition-colors duration-150"
            >
              <span className="text-base leading-none">+</span>
              {useMultiplier ? 'Agregar posición / multiplicador' : 'Agregar posición'}
            </button>
          </div>
        </div>
      )}

      {/* Live preview */}
      {rows.length > 0 && (
        <div className="rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 px-4 py-3">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Previsualización de Puntos</p>
          <p className="text-sm text-white/80">
            1° lugar + {previewKills} kills ={' '}
            <span className="text-neon-cyan font-semibold">{previewTotal.toFixed(2).replace(/\.00$/, '')} pts</span>
            <span className="text-white/30 ml-2 text-xs">
              {useMultiplier
                ? `(${previewKills} kills × ${killPoints} pts × ${previewPlacementValue}x multiplicador)`
                : `(${previewPlacementValue} posición + ${killPoints} × ${previewKills} kills)`
              }
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function ScoringRow({ 
  initialPos, 
  initialPts, 
  useMultiplier, 
  onUpdate, 
  onRemove 
}: { 
  initialPos: number, 
  initialPts: number, 
  useMultiplier: boolean,
  onUpdate: (oldPos: number, newPos: number, pts: number) => void,
  onRemove: (pos: number) => void 
}) {
  const [pos, setPos] = useState(initialPos)
  const [pts, setPts] = useState(initialPts)

  useEffect(() => {
    setPos(initialPos)
    setPts(initialPts)
  }, [initialPos, initialPts])

  const handleBlur = () => {
    if (pos !== initialPos || pts !== initialPts) {
      onUpdate(initialPos, pos, pts)
    }
  }

  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-2">
        <input
          type="number"
          min={1}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          onBlur={handleBlur}
          className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-neon-cyan/50 focus:outline-none transition-all duration-150"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          min={0}
          step={useMultiplier ? 0.01 : 1}
          value={pts}
          onChange={(e) => setPts(Number(e.target.value))}
          onBlur={handleBlur}
          className="w-24 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-neon-cyan/50 focus:outline-none transition-all duration-150"
        />
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={() => onRemove(initialPos)}
          className="w-7 h-7 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
        >
          ×
        </button>
      </td>
    </tr>
  )
}
