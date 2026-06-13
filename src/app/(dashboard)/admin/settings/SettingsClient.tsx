'use client'

import React, { useState, useRef } from 'react'
import { Orbitron } from 'next/font/google'
import { updateLandingSettings, type LandingSettings } from '@/lib/actions/landing-settings'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const orbitron = Orbitron({ subsets: ['latin'] })

interface SettingsClientProps {
  initialSettings: LandingSettings
  activeCount: number
  totalViewers: number
}

export function SettingsClient({ initialSettings, activeCount, totalViewers }: SettingsClientProps) {
  const router = useRouter()
  const [settings, setSettings] = useState<LandingSettings>(initialSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage(null)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `ambient-bg-${Date.now()}.${fileExt}`
      const filePath = `branding/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidences')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('evidences')
        .getPublicUrl(filePath)

      setSettings(prev => ({
        ...prev,
        ambient_video_url: publicUrl
      }))
      
      setMessage({ type: 'success', text: 'Archivo de fondo subido correctamente. Haz clic en Guardar Cambios para aplicar.' })
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error al subir el archivo: ' + err.message })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteBackground = () => {
    setSettings(prev => ({
      ...prev,
      ambient_video_url: ''
    }))
    setMessage({ type: 'success', text: 'Fondo eliminado. Haz clic en Guardar Cambios para aplicar.' })
  }

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

          {/* Live Ticker Preview (Non-editable, Subject to real statistics) */}
          <div className="space-y-2">
            <label className="text-white/60 font-bold uppercase tracking-widest text-[10px] block">Insignia de Estado En Vivo (Live Ticker)</label>
            <div className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 flex items-center gap-2 select-none">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>
                ● {activeCount} Torneo{activeCount === 1 ? '' : 's'} Activo{activeCount === 1 ? '' : 's'} ahora · 👥 {totalViewers.toLocaleString('es-ES')} Espectadores
              </span>
            </div>
            <p className="text-[9px] text-neon-cyan/80 font-semibold">
              ✔ Automatizado con estadísticas reales de la base de datos (se genera según los torneos activos).
            </p>
          </div>

          {/* Ambient Background Section */}
          <div className="space-y-4 md:col-span-2 bg-white/[0.01] border border-white/5 p-5 rounded-2xl">
            <h3 className="text-white/80 font-bold uppercase tracking-widest text-[11px]">Fondo de la Landing Page</h3>
            <p className="text-white/40 text-xs">Carga directamente un archivo (imagen o vídeo) o introduce una URL externa.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Upload & Input */}
              <div className="space-y-3">
                <label className="text-white/60 font-bold uppercase tracking-widest text-[9px] block">Cargar archivo de fondo (Vídeo o Imagen)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,video/mp4,video/webm"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 px-4 bg-white/5 border border-white/10 hover:border-neon-cyan/50 rounded-xl text-xs font-bold text-white uppercase tracking-widest transition-all text-center"
                  >
                    {uploading ? 'Subiendo archivo...' : 'Seleccionar Archivo'}
                  </button>
                  {settings.ambient_video_url && (
                    <button
                      type="button"
                      onClick={handleDeleteBackground}
                      className="px-4 py-3 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-xl text-xs font-bold text-red-400 uppercase tracking-widest transition-all"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label className="text-white/60 font-bold uppercase tracking-widest text-[9px] block">O introducir URL del fondo</label>
                  <input
                    type="text"
                    name="ambient_video_url"
                    value={settings.ambient_video_url}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan transition-colors"
                    placeholder="Ej: https://tudominio.com/background.mp4"
                  />
                </div>
              </div>

              {/* Preview Box */}
              <div className="border border-white/5 rounded-xl p-4 bg-white/[0.01] min-h-[160px] flex flex-col items-center justify-center relative overflow-hidden">
                {settings.ambient_video_url ? (
                  (() => {
                    const isVideo = settings.ambient_video_url.toLowerCase().match(/\.(mp4|webm|ogg)$/) || settings.ambient_video_url.includes('/video/');
                    return (
                      <div className="w-full h-full min-h-[120px] relative flex flex-col items-center justify-center gap-2">
                        {isVideo ? (
                          <video
                            src={settings.ambient_video_url}
                            className="max-h-[120px] w-auto rounded border border-white/10"
                            controls
                            muted
                          />
                        ) : (
                          <img
                            src={settings.ambient_video_url}
                            alt="Vista previa de fondo"
                            className="max-h-[120px] w-auto object-contain rounded border border-white/10"
                          />
                        )}
                        <span className="text-[9px] text-white/50 uppercase tracking-wider font-semibold">
                          Fondo actual ({isVideo ? 'Vídeo' : 'Imagen'})
                        </span>
                      </div>
                    )
                  })()
                ) : (
                  <div className="text-center p-4">
                    <span className="text-2xl mb-2 block grayscale opacity-30">🖼️</span>
                    <span className="text-[10px] text-white/30 uppercase font-black">Sin fondo personalizado</span>
                  </div>
                )}
              </div>
            </div>
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
