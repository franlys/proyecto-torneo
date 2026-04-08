'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createSubmission } from '@/lib/actions/submissions'

export function TeamPortalClient({
  tournament,
  team,
  participants,
  matches,
}: {
  tournament: any
  team: any
  participants: any[]
  matches: any[]
}) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [selectedParentId, setSelectedParentId] = useState('')

  const supabase = createClient()

  // Identify parent matches (Encuentros)
  const parentMatches = matches.filter(m => !m.parent_match_id)
  // Identify rounds for the selected parent
  const availableRounds = matches.filter(m => m.parent_match_id === selectedParentId)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = e.currentTarget
    
    // If there are rounds, we use the round ID, otherwise the parent ID
    const roundSelect = form.elements.namedItem('roundId') as HTMLSelectElement
    const matchId = roundSelect ? roundSelect.value : (form.elements.namedItem('matchId') as HTMLSelectElement).value
    
    const submittedBy = (form.elements.namedItem('submittedBy') as HTMLSelectElement).value
    const killCount = parseInt((form.elements.namedItem('killCount') as HTMLInputElement).value, 10)
    const potTop = tournament.pot_top_enabled 
      ? (form.elements.namedItem('potTop') as HTMLInputElement).checked 
      : false
    const fileBase = form.elements.namedItem('evidenceFile') as HTMLInputElement
    const file = fileBase?.files?.[0]

    if (!file) {
      setError('Debes subir una imagen de evidencia')
      setLoading(false)
      return
    }

    try {
      // 1. Upload file to Supabase Storage (bucket: evidence)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${tournament.id}/${team.id}/${matchId}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error('Error al subir la imagen. Asegúrate de que el formato sea válido (JPEG/PNG) y no supere los 5MB. ' + uploadError.message)
      }

      // 2. Submit the form data with the file info to our Server Action
      const res = await createSubmission({
        tournamentId: tournament.id,
        teamId: team.id,
        matchId: matchId,
        submittedBy: submittedBy,
        killCount: isNaN(killCount) ? 0 : killCount,
        potTop: potTop,
        evidence: {
          storagePath: uploadData.path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }
      } as any) // Type asserted because we'll update the schema next

      if ('error' in res) {
        // Rollback image upload
        await supabase.storage.from('evidence').remove([uploadData.path])
        throw new Error(res.error)
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-neon-cyan/20 border border-neon-cyan mx-auto flex items-center justify-center mb-6">
          <span className="text-neon-cyan text-3xl">✓</span>
        </div>
        <h3 className="text-2xl font-orbitron font-bold text-white mb-2">¡Evidencia Enviada!</h3>
        <p className="text-white/60 mb-6">El organizador revisará los resultados pronto.</p>
        <button 
          onClick={() => {
            setSuccess(false)
            setError('')
          }}
          className="text-neon-cyan text-sm hover:underline"
        >
          Enviar otra partida
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm text-white/50 mb-1.5 ml-1">Encuentro / Partida</label>
        <select 
          name="matchId" 
          required
          value={selectedParentId}
          onChange={(e) => setSelectedParentId(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all text-white"
        >
          <option value="">Selecciona una partida...</option>
          {parentMatches.map(m => (
            <option key={m.id} value={m.id}>
              {m.name ? m.name : `Partida ${m.match_number}`}
            </option>
          ))}
        </select>
      </div>

      {availableRounds.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="block text-sm text-white/50 mb-1.5 ml-1">Especifique la Ronda / Mapa</label>
          <select 
            name="roundId" 
            required
            className="w-full bg-black/40 border border-neon-cyan/30 rounded-lg px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all text-neon-cyan font-medium"
          >
            <option value="">Selecciona la ronda...</option>
            {availableRounds.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} {r.map_name ? `(${r.map_name})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm text-white/50 mb-1.5 ml-1">¿Quién está subiendo esto?</label>
        <select 
          name="submittedBy" 
          required
          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all text-white"
        >
          {participants.map(p => (
            <option key={p.id} value={p.id}>
              {p.display_name} {p.is_captain && '(Capitán)'}
            </option>
          ))}
          {participants.length === 0 && <option value="">No hay jugadores registrados</option>}
        </select>
      </div>

      <div className="flex gap-4">
        <div className="flex-[2]">
          <label className="block text-sm text-white/50 mb-1.5 ml-1">Kills del equipo</label>
          <input 
            type="number" 
            name="killCount" 
            required 
            min="0"
            placeholder="0"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all font-orbitron text-xl text-neon-cyan text-center"
          />
        </div>
        
        {tournament.pot_top_enabled && (
          <div className="flex-[1] flex items-end">
            <label className="flex items-center gap-3 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-3 cursor-pointer transition-colors group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  name="potTop" 
                  className="peer sr-only"
                />
                <div className="w-5 h-5 border-2 border-white/20 peer-checked:border-gold peer-checked:bg-gold rounded flex items-center justify-center transition-all">
                  <svg className="w-3 h-3 text-black opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
              </div>
              <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">TOP 1</span>
            </label>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-white/50 mb-1.5 ml-1">Sube la captura de pantalla</label>
        <input 
          type="file" 
          name="evidenceFile" 
          accept="image/*"
          required
          className="w-full text-sm text-white/50 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-neon-cyan/10 file:text-neon-cyan hover:file:bg-neon-cyan/20 file:transition-colors bg-black/20 border border-white/10 rounded-lg p-2"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || participants.length === 0}
        className="w-full relative group overflow-hidden rounded-xl p-[1px] disabled:opacity-50 mt-4"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-neon-cyan to-neon-purple opacity-70 group-hover:opacity-100 transition-opacity" />
        <div className="relative bg-dark-bg px-8 py-3.5 rounded-xl transition-all group-hover:bg-opacity-0">
          <span className="relative font-bold text-white tracking-widest uppercase">
            {loading ? 'Enviando...' : 'Subir Resultados'}
          </span>
        </div>
      </button>
    </form>
  )
}
