'use client'

import React, { useState } from 'react'
import { Orbitron } from 'next/font/google'
import { updateLandingSettings, type LandingSettings } from '@/lib/actions/landing-settings'
import { useRouter } from 'next/navigation'

const orbitron = Orbitron({ subsets: ['latin'] })

interface SettingsClientProps {
  initialSettings: LandingSettings
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const router = useRouter()
  const [settings, setSettings] = useState<LandingSettings>(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    const res = await updateLandingSettings(settings)

    if (res?.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setMessage({ type: 'success', text: '¡Configuración del inicio actualizada correctamente!' })
      router.refresh()
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className={`${orbitron.className} text-2xl sm:text-3xl font-black text-white uppercase tracking-widest`}>
          Configuración de Página de Inicio
        </h1>
        <p className="text-white/40 text-sm mt-1">Personaliza el título, subtítulo, tickers dinámicos y marca visual de la landing page principal</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white/[0.02] border border-white/5 rounded-3xl p-6 sm:p-8">
        
        {/* Feedback Message */}
        {message && (
          <div className={`p-4 rounded-xl border text-sm font-medium ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hero Title */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">Título Principal (Hero Title)</label>
            <input
              type="text"
              name="hero_title"
              value={settings.hero_title}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
              placeholder="Ej: EL PORTAL DE LOS E-SPORTS DOMINICANOS"
            />
            <p className="text-[10px] text-white/30">Nota: Las últimas dos palabras se formatearán automáticamente con el gradiente de neón.</p>
          </div>

          {/* Hero Subtitle */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">Subtítulo Descriptivo (Hero Subtitle)</label>
            <textarea
              name="hero_subtitle"
              value={settings.hero_subtitle}
              onChange={handleChange}
              rows={3}
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors resize-none"
              placeholder="Introduce la descripción principal de la plataforma..."
            />
          </div>

          {/* Live Ticker Text */}
          <div className="space-y-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">Insignia de Estado En Vivo (Live Ticker)</label>
            <input
              type="text"
              name="live_ticker_text"
              value={settings.live_ticker_text}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
              placeholder="Ej: ● 3 Torneos Activos ahora"
            />
            <p className="text-[9px] text-white/30">Texto de urgencia que aparece arriba del título principal.</p>
          </div>

          {/* Video URL */}
          <div className="space-y-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">URL de Vídeo de Fondo (Opcional MP4)</label>
            <input
              type="text"
              name="ambient_video_url"
              value={settings.ambient_video_url}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
              placeholder="Ej: https://tudominio.com/esports-background.mp4"
            />
            <p className="text-[9px] text-white/30">Dejar en blanco para usar gradiente de color estándar.</p>
          </div>

          {/* Statistics Ticker Text */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">Barra Ticker de Estadísticas (Desplazamiento Infinito)</label>
            <textarea
              name="statistics_ticker_text"
              value={settings.statistics_ticker_text}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors resize-none"
              placeholder="Ej: 🏆 120+ Torneos Realizados ── 🛡️ 4,500+ Atletas Federados"
            />
            <p className="text-[9px] text-white/30">Texto en mayúsculas que se desplaza infinitamente en la página principal.</p>
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">Color Primario de Neón</label>
            <div className="flex gap-2">
              <input
                type="color"
                name="primary_color"
                value={settings.primary_color}
                onChange={handleChange}
                className="w-12 h-11 bg-white/5 border border-white/10 rounded-xl p-1 cursor-pointer focus:outline-none"
              />
              <input
                type="text"
                name="primary_color"
                value={settings.primary_color}
                onChange={handleChange}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
                placeholder="#00F5FF"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div className="space-y-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">Color Secundario de Neón</label>
            <div className="flex gap-2">
              <input
                type="color"
                name="secondary_color"
                value={settings.secondary_color}
                onChange={handleChange}
                className="w-12 h-11 bg-white/5 border border-white/10 rounded-xl p-1 cursor-pointer focus:outline-none"
              />
              <input
                type="text"
                name="secondary_color"
                value={settings.secondary_color}
                onChange={handleChange}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
                placeholder="#BD00FF"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 bg-neon-cyan disabled:bg-neon-cyan/50 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-all"
            style={{ backgroundColor: settings.primary_color, boxShadow: `0 0 25px ${settings.primary_color}30` }}
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
