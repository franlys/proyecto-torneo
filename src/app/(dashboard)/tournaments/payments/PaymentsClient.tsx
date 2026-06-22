'use client'

import { useState } from 'react'
import { updateStreamerSettings } from '@/lib/actions/profile'
import { Info, HelpCircle, CheckCircle, Save, Settings, ShieldAlert } from 'lucide-react'

interface PaymentsClientProps {
  initialOrgName: string | null
  initialPaymentDetails: string | null
  initialDiscordLink: string | null
  initialWhatsappLink: string | null
}

export function PaymentsClient({
  initialOrgName,
  initialPaymentDetails,
  initialDiscordLink,
  initialWhatsappLink,
}: PaymentsClientProps) {
  const [orgName, setOrgName] = useState(initialOrgName || '')
  const [paymentDetails, setPaymentDetails] = useState(initialPaymentDetails || '')
  const [discordLink, setDiscordLink] = useState(initialDiscordLink || '')
  const [whatsappLink, setWhatsappLink] = useState(initialWhatsappLink || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const formData = new FormData()
    formData.append('organization_name', orgName)
    formData.append('payment_details', paymentDetails)
    formData.append('discord_link', discordLink)
    formData.append('whatsapp_link', whatsappLink)

    const res = await updateStreamerSettings(formData)
    if ('error' in res) {
      setError(res.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setLoading(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Configuration Form */}
      <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
        <div className="bg-[#121219] border border-white/5 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-neon-cyan shrink-0" />
            <h3 className="text-lg font-bold text-white">Configuración del Portal</h3>
          </div>

          <div className="space-y-4">
            {/* Organization Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Nombre de la Organización</label>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-white/20 hover:text-white/40 cursor-help" />
                  <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-black/95 border border-white/10 rounded-xl text-[10px] text-white/60 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                    Se mostrará públicamente como la marca organizadora de tus torneos.
                  </div>
                </div>
              </div>
              <input
                type="text"
                placeholder="Ej. Gaming Club Dominicana"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white font-medium"
              />
            </div>

            {/* Payment Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Detalles e Instrucciones de Pago</label>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-white/20 hover:text-white/40 cursor-help" />
                  <div className="absolute right-0 bottom-full mb-2 w-72 p-3 bg-black/95 border border-white/10 rounded-xl text-[10px] text-white/60 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                    Escribe detalladamente las instrucciones que verán los capitanes de equipo al registrarse (número de cuenta, Binance ID, PayPal, etc.).
                  </div>
                </div>
              </div>
              <textarea
                rows={6}
                placeholder="Ej. Para inscribirte, realiza una transferencia de $10 USD a la siguiente cuenta bancaria: ... o envía por Binance Pay: ... adjuntando luego tu captura de pantalla de comprobante de pago."
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white font-medium resize-none leading-relaxed"
              />
            </div>

            {/* Communication Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Discord Link */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Enlace de Discord</label>
                <input
                  type="url"
                  placeholder="https://discord.gg/invitacion"
                  value={discordLink}
                  onChange={(e) => setDiscordLink(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white"
                />
              </div>

              {/* WhatsApp Link */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Enlace de WhatsApp</label>
                <input
                  type="url"
                  placeholder="https://chat.whatsapp.com/invitacion"
                  value={whatsappLink}
                  onChange={(e) => setWhatsappLink(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Ajustes guardados correctamente.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neon-cyan text-black font-black uppercase tracking-widest text-xs py-3.5 rounded-xl hover:bg-[#00D1DB] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar Ajustes'}
          </button>
        </div>
      </form>

      {/* Right Column: Visual Explanations & Walkthroughs */}
      <div className="space-y-6">
        {/* Note Card: How players see this */}
        <div className="bg-[#121219] border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-neon-cyan">
            <Info className="w-4.5 h-4.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">¿Cómo se muestra al jugador?</span>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white">1. Proceso de Inscripción</p>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Cuando un equipo se registre en tus torneos, verá exactamente tu texto de **Detalles de Pago** en la pantalla de confirmación. Tendrán que subir una foto del comprobante para finalizar la inscripción.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white">2. Soporte y Comunicación</p>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Tus links de Discord/WhatsApp se colocarán en botones de contacto rápidos dentro de la landing page del torneo. Así los jugadores podrán unirse a tus comunidades fácilmente para recibir soporte de tu staff.
              </p>
            </div>
          </div>
        </div>

        {/* Note Card: Responsibility Warning */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-yellow-400">
            <ShieldAlert className="w-4.5 h-4.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Responsabilidad de Pagos</span>
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed">
            Kronix actúa únicamente como facilitador visual del proceso. La recolección de los fondos de tus torneos es tu entera responsabilidad. Valida minuciosamente cada captura de pantalla de evidencia subida por los capitanes en tu panel de torneo antes de aprobarlos en el listado.
          </p>
        </div>
      </div>
    </div>
  )
}
