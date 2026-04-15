'use client'

import { useState, useTransition } from 'react'
import { generateStreamerCode, toggleStreamerCode } from '@/lib/actions/codes'
import { useRouter } from 'next/navigation'

interface Code {
  id: string
  code: string
  streamer_name: string
  is_active: boolean
  created_at: string
}

export function DashboardStreamerCodeManager({
  tournamentId,
  initialCodes,
}: {
  tournamentId: string
  initialCodes: Code[]
}) {
  const [streamerName, setStreamerName] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!streamerName.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await generateStreamerCode(tournamentId, streamerName.trim(), customCode.trim())
      if ('error' in res) {
        setError(res.error)
      } else {
        setStreamerName('')
        setCustomCode('')
        router.refresh()
      }
    })
  }

  function handleToggle(codeId: string, current: boolean) {
    startTransition(async () => {
      await toggleStreamerCode(codeId, !current)
      router.refresh()
    })
  }

  function copyToClipboard(code: string) {
    navigator.clipboard.writeText(code)
  }

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-sm">Generar nuevo código</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Nombre del streamer *</label>
            <input
              value={streamerName}
              onChange={(e) => setStreamerName(e.target.value)}
              placeholder="Ej: Franlys"
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              Código personalizado <span className="text-white/20">(opcional — se genera uno si está vacío)</span>
            </label>
            <input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="Ej: FRANLYS-WZ"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors text-sm font-mono"
            />
          </div>
          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending || !streamerName.trim()}
            className="w-full py-2.5 bg-neon-cyan text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isPending ? 'Generando...' : 'Generar código'}
          </button>
        </form>
      </div>

      {/* Lista de códigos */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h2 className="text-white/60 text-xs uppercase tracking-widest font-semibold">
            Códigos generados ({initialCodes.length})
          </h2>
        </div>
        {initialCodes.length === 0 ? (
          <p className="px-5 py-8 text-center text-white/20 text-sm">
            Sin códigos aún — genera el primero arriba
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {initialCodes.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => copyToClipboard(c.code)}
                    title="Copiar código"
                    className="shrink-0"
                  >
                    <code className={`text-sm font-mono font-bold px-2 py-0.5 rounded transition-colors ${
                      c.is_active
                        ? 'text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan/20'
                        : 'text-white/30 bg-white/5 line-through'
                    }`}>
                      {c.code}
                    </code>
                  </button>
                  <span className="text-white/50 text-sm truncate">{c.streamer_name}</span>
                </div>
                <button
                  onClick={() => handleToggle(c.id, c.is_active)}
                  disabled={isPending}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-40 shrink-0 ${
                    c.is_active
                      ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                      : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                  }`}
                >
                  {c.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
