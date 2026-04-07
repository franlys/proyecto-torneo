'use client'

import { useState } from 'react'
import { updateTheme } from '@/lib/actions/themes'
import Link from 'next/link'

export function ThemeEditor({ tournamentId, initialTheme, slug }: { tournamentId: string, initialTheme: any, slug: string }) {
  const [primaryColor, setPrimaryColor] = useState(initialTheme?.primary_color || '#00F5FF')
  const [backgroundValue, setBackgroundValue] = useState(initialTheme?.background_value || '')
  const [logoUrl, setLogoUrl] = useState(initialTheme?.logo_url || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const PRESET_COLORS = [
    { label: 'Neon Cyan', value: '#00F5FF' },
    { label: 'Neon Purple', value: '#8B5CF6' },
    { label: 'Gold', value: '#FFD700' },
    { label: 'Crimson', value: '#FF3366' },
    { label: 'Toxic Green', value: '#00FF66' },
  ]

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    
    const res = await updateTheme(tournamentId, { 
      primary_color: primaryColor,
      background_value: backgroundValue || null,
      logo_url: logoUrl || null
    })
    setSaving(false)
    
    if ('error' in res) {
      alert(res.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Settings Form */}
      <div className="bg-dark-card border border-white/5 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm text-white/70 mb-3 font-medium">Color Principal (Acentos)</label>
            <div className="flex flex-wrap gap-3 mb-4">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setPrimaryColor(c.value)}
                  className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${primaryColor === c.value ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value, boxShadow: primaryColor === c.value ? `0 0 15px ${c.value}80` : 'none' }}
                  title={c.label}
                />
              ))}
            </div>
            <div className="flex gap-3 items-center">
              <input 
                type="color" 
                value={primaryColor} 
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded bg-transparent cursor-pointer"
              />
              <input 
                type="text" 
                value={primaryColor} 
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 outline-none uppercase font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <label className="block text-sm text-white/70 mb-2 font-medium">Fondo Remoto (URL de foto o vídeo)</label>
            <input 
              type="text" 
              placeholder="https://ejemplo.com/fondo.mp4"
              value={backgroundValue} 
              onChange={(e) => setBackgroundValue(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 outline-none"
            />
            <p className="text-xs text-white/40 mt-2">Puedes colocar el link de un .jpg, .png o .mp4 para que se despliegue en la vista pública.</p>
          </div>

          <div className="pt-4 border-t border-white/5">
            <label className="block text-sm text-white/70 mb-2 font-medium">Logo del Torneo (URL)</label>
            <input 
              type="text" 
              placeholder="https://ejemplo.com/logo.png"
              value={logoUrl} 
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/30 outline-none"
            />
          </div>

          <div className="pt-4 border-t border-white/5">
            <button
              type="submit"
              disabled={saving}
              className={`w-full py-3 rounded-xl text-sm font-semibold text-black transition-all ${
                success ? 'bg-green-400' : 'bg-white hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {saving ? 'Guardando...' : (success ? '¡Guardado!' : 'Guardar Tema')}
            </button>
          </div>
        </form>
      </div>

      {/* Preview Map */}
      <div>
        <div className="bg-black border border-white/10 rounded-2xl p-6 relative overflow-hidden"
             style={{ boxShadow: `0 20px 40px -20px ${primaryColor}20` }}>
          <div className="absolute top-0 w-full h-1" style={{ backgroundColor: primaryColor }} />
          
          <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-6">Preview en Vivo</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white/[0.03] p-3 rounded-lg border border-white/5">
              <span className="text-white font-orbitron">#1 Equipo Alpha</span>
              <span className="font-orbitron font-bold text-xl" style={{ color: primaryColor }}>150</span>
            </div>
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-lg border border-white/5">
              <span className="text-white font-orbitron">#2 Beta Squad</span>
              <span className="font-orbitron font-bold text-xl text-white/50">120</span>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link 
              href={`/t/${slug}`} 
              target="_blank"
              className="inline-block px-4 py-2 border rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
            >
              Abrir vista completa ↗
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
