'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateTournament } from '@/lib/actions/tournaments'
import { toast } from 'sonner'

interface TournamentBrandingProps {
  id: string
  initialLogoUrl?: string
  tournamentName: string
  initialHideLogoInLeaderboard?: boolean
}

export function TournamentBranding({ id, initialLogoUrl, tournamentName, initialHideLogoInLeaderboard }: TournamentBrandingProps) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [hideLogo, setHideLogo] = useState(initialHideLogoInLeaderboard || false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${id}-tournament-logo.${fileExt}`
      const filePath = `branding/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidences')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('evidences')
        .getPublicUrl(filePath)

      const res = await updateTournament(id, { logoUrl: publicUrl })
      if ('error' in res) throw new Error(res.error)

      setLogoUrl(publicUrl)
      toast.success('Logo del torneo actualizado con éxito')
    } catch (err: any) {
      toast.error('Error al subir el logo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteLogo = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar el logo del torneo?')) return

    setUploading(true)
    try {
      const res = await updateTournament(id, { logoUrl: null })
      if ('error' in res) throw new Error(res.error)

      setLogoUrl(undefined)
      toast.success('Logo del torneo eliminado con éxito')
    } catch (err: any) {
      toast.error('Error al eliminar el logo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleToggleHideLogo = async (checked: boolean) => {
    try {
      const res = await updateTournament(id, { hideLogoInLeaderboard: checked })
      if ('error' in res) throw new Error(res.error)
      setHideLogo(checked)
      toast.success(checked ? 'Logo ocultado en el Leaderboard público' : 'Logo visible en el Leaderboard público')
    } catch (err: any) {
      toast.error('Error al actualizar preferencia: ' + err.message)
    }
  }

  return (
    <div className="mb-8 p-6 bg-dark-card border border-neon-purple/20 rounded-2xl shadow-lg shadow-neon-purple/5">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative w-32 h-32 rounded-xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:border-neon-purple/50 transition-all flex items-center justify-center group"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={tournamentName} className="w-full h-full object-contain p-2" />
          ) : (
            <div className="text-center p-4">
              <span className="text-3xl mb-2 block grayscale opacity-30">🏆</span>
              <span className="text-[10px] text-white/30 uppercase font-black">Sin Logo</span>
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[9px] font-black uppercase tracking-widest">Cambiar Logo</span>
          </div>

          {uploading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-neon-purple border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <h2 className="text-lg font-orbitron font-black text-white uppercase tracking-tighter mb-2">
            Identidad del Torneo
          </h2>
          <p className="text-sm text-white/40 mb-4 max-w-lg">
            Sustituye el nombre escrito del torneo por un logo personalizado en el leaderboard público. 
            Se recomienda usar imágenes cuadradas o rectangulares en formato PNG transparente.
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-purple/50 rounded-lg text-xs font-bold text-white transition-all uppercase tracking-widest"
            >
              {logoUrl ? 'Cambiar Logo de Marca' : 'Subir Logo de Marca'}
            </button>
            {logoUrl && (
              <button
                onClick={handleDeleteLogo}
                disabled={uploading}
                className="px-5 py-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/50 rounded-lg text-xs font-bold text-red-400 transition-all uppercase tracking-widest"
              >
                Eliminar Logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-white/5">
        <label className="flex items-center gap-3 cursor-pointer group w-fit">
          <input
            type="checkbox"
            checked={hideLogo}
            onChange={(e) => handleToggleHideLogo(e.target.checked)}
            className="rounded border-white/10 bg-white/5 text-neon-purple focus:ring-neon-purple focus:ring-offset-dark-bg w-4 h-4 cursor-pointer"
          />
          <div>
            <span className="text-sm font-semibold text-white group-hover:text-neon-purple transition-colors">
              Usar logo solo para miniatura / vista previa
            </span>
            <span className="block text-xs text-white/40 mt-0.5">
              Si se activa, el logo no se mostrará en el fondo/cabecera del tablero público (útil si tu fondo ya incluye el logo).
            </span>
          </div>
        </label>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
        className="hidden"
      />
    </div>
  )
}
