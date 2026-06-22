'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteStaffMember, removeStaffMember, cancelInvitation, acceptInvitation, rejectInvitation } from '@/lib/actions/streamer-staff'
import { Shield, Mail, Trash2, Check, X, Info, Plus } from 'lucide-react'

interface StaffPortalClientProps {
  activeStaff: any[]
  pendingInvites: any[]
  myInvites: any[]
}

const ROLE_LABELS: Record<string, string> = {
  editor: 'Editor / Administrador',
  referee: 'Árbitro / Moderador',
  analyst: 'Analista / Solo Lectura',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  editor: 'Puede modificar torneos, crear partidas, gestionar brackets y manejar inscripciones. No puede borrar la cuenta ni cambiar los métodos de pago.',
  referee: 'Puede validar o rechazar evidencias de envíos y reportar marcadores. No puede cambiar la configuración del torneo.',
  analyst: 'Tiene permisos de lectura para ver inscripciones y evidencias. No puede modificar ningún dato.',
}

export function StaffPortalClient({
  activeStaff,
  pendingInvites,
  myInvites,
}: StaffPortalClientProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'referee' | 'analyst'>('editor')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setMessage(null)

    const res = await inviteStaffMember(email, role)
    if ('error' in res) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setMessage({ type: 'success', text: `Invitación enviada con éxito a ${email}.` })
      setEmail('')
      router.refresh()
    }
    setLoading(false)
  }

  const handleRemoveStaff = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas remover a ${name} de tu staff? Perderá acceso a tus torneos.`)) return
    const res = await removeStaffMember(id)
    if ('error' in res) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  const handleCancelInvite = async (id: string) => {
    if (!confirm('¿Deseas cancelar esta invitación pendiente?')) return
    const res = await cancelInvitation(id)
    if ('error' in res) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  const handleAcceptInvite = async (id: string) => {
    const res = await acceptInvitation(id)
    if ('error' in res) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  const handleRejectInvite = async (id: string) => {
    if (!confirm('¿Deseas rechazar esta invitación de staff?')) return
    const res = await rejectInvitation(id)
    if ('error' in res) {
      alert(res.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-8">
      {/* ─── Invitations to ME ─────────────────────────────────────────────────── */}
      {myInvites.length > 0 && (
        <div className="bg-neon-purple/10 border border-neon-purple/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">✉️</span>
            <div>
              <h3 className="font-bold text-white">Tienes invitaciones de staff pendientes</h3>
              <p className="text-xs text-white/50">Otros streamers te han invitado a colaborar en sus torneos.</p>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {myInvites.map((invite) => (
              <div key={invite.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">
                    {invite.streamer?.organization_name || invite.streamer?.username}
                  </p>
                  <p className="text-xs text-white/40">Rol propuesto: <span className="text-neon-cyan font-bold">{ROLE_LABELS[invite.role]}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptInvite(invite.id)}
                    className="p-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg hover:bg-green-500/20 transition-all flex items-center gap-1.5 text-xs font-bold"
                  >
                    <Check className="w-3.5 h-3.5" /> Aceptar
                  </button>
                  <button
                    onClick={() => handleRejectInvite(invite.id)}
                    className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-all flex items-center gap-1.5 text-xs font-bold"
                  >
                    <X className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Invite Form & Guides */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#121219] border border-white/5 rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white">Invitar Colaborador</h3>
              <p className="text-xs text-white/40 mt-1">Envía una invitación por correo para sumar personal a tu staff.</p>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/20 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="email@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Rol de Staff</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white cursor-pointer"
                >
                  <option value="editor">Editor (Acceso Total)</option>
                  <option value="referee">Moderador (Validación y Evidencias)</option>
                  <option value="analyst">Analista (Solo Lectura)</option>
                </select>
              </div>

              {message && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                  message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-500'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neon-cyan text-black font-black uppercase tracking-widest text-xs py-3.5 rounded-xl hover:bg-[#00D1DB] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> {loading ? 'Enviando...' : 'Enviar Invitación'}
              </button>
            </form>
          </div>

          {/* Guide Note Card */}
          <div className="bg-[#121219]/40 border border-white/5 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center gap-2 text-neon-cyan">
              <Info className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Guía de Roles</span>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-white/80">{ROLE_LABELS.editor}</p>
                <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed">{ROLE_DESCRIPTIONS.editor}</p>
              </div>
              <div>
                <p className="font-bold text-white/80">{ROLE_LABELS.referee}</p>
                <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed">{ROLE_DESCRIPTIONS.referee}</p>
              </div>
              <div>
                <p className="font-bold text-white/80">{ROLE_LABELS.analyst}</p>
                <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed">{ROLE_DESCRIPTIONS.analyst}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Staff & Pending Invites lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Staff List */}
          <div className="bg-[#121219] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Colaboradores Activos</h3>
            
            {activeStaff.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/5 rounded-xl text-white/20 text-xs italic">
                Aún no has agregado colaboradores a tu staff.
              </div>
            ) : (
              <div className="space-y-3">
                {activeStaff.map((member) => (
                  <div key={member.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {member.staff?.avatar_url ? (
                        <img
                          src={member.staff.avatar_url}
                          alt={member.staff.username || 'Avatar'}
                          className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm shrink-0">
                          👤
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {member.staff?.username || <span className="text-white/40 italic">Sin username</span>}
                        </p>
                        <p className="text-xs text-white/40 truncate">{member.staff?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-white/5 border border-white/10 text-white/60">
                        {ROLE_LABELS[member.role] || member.role}
                      </span>
                      <button
                        onClick={() => handleRemoveStaff(member.id, member.staff?.username || member.staff?.email)}
                        className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Remover del staff"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invites List */}
          <div className="bg-[#121219] border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Invitaciones Pendientes</h3>

            {pendingInvites.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/5 rounded-xl text-white/20 text-xs italic">
                No hay invitaciones pendientes.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/80 truncate">{invite.email}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Rol: <span className="text-neon-cyan font-bold">{ROLE_LABELS[invite.role]}</span> • Enviado: {new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelInvite(invite.id)}
                      className="px-3 py-1.5 bg-white/5 border border-white/5 hover:border-red-500/20 text-white/40 hover:text-red-400 text-xs font-semibold rounded-lg transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
