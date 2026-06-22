'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket, replyToTicket, getTicketDetails, updateTicketStatus } from '@/lib/actions/support-tickets'
import { MessageSquare, Calendar, Loader2, Send, CheckCircle2, Ticket, ArrowLeft } from 'lucide-react'

interface SupportPortalClientProps {
  initialTickets: any[]
}

export function SupportPortalClient({ initialTickets }: SupportPortalClientProps) {
  const [tickets, setTickets] = useState<any[]>(initialTickets)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  
  // Selected ticket details
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [fetchingDetails, setFetchingDetails] = useState(false)

  // Form states
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const router = useRouter()

  const loadTicketDetails = async (id: string) => {
    setFetchingDetails(true)
    setSelectedTicketId(id)
    const res = await getTicketDetails(id)
    if ('error' in res) {
      alert(res.error)
      setSelectedTicketId(null)
    } else {
      setSelectedTicket(res.ticket)
      setMessages(res.messages)
    }
    setFetchingDetails(false)
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return

    setCreatingTicket(true)
    setError('')
    setSuccess('')

    const res = await createTicket(subject, message)
    if ('error' in res) {
      setError(res.error)
    } else {
      setSuccess('Tu ticket ha sido creado correctamente. Nuestro equipo lo revisará a la brevedad.')
      setSubject('')
      setMessage('')
      router.refresh()
    }
    setCreatingTicket(false)
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !selectedTicketId) return

    setReplying(true)
    const res = await replyToTicket(selectedTicketId, replyText)
    if ('error' in res) {
      alert(res.error)
    } else {
      setReplyText('')
      // Reload thread
      await loadTicketDetails(selectedTicketId)
      router.refresh()
    }
    setReplying(false)
  }

  const handleCloseTicket = async () => {
    if (!selectedTicketId) return
    if (!confirm('¿Deseas marcar este ticket como Resuelto?')) return

    const res = await updateTicketStatus(selectedTicketId, 'resolved')
    if ('error' in res) {
      alert(res.error)
    } else {
      await loadTicketDetails(selectedTicketId)
      
      // Update local status in list
      setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: 'resolved' } : t))
      router.refresh()
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    open: 'Abierto',
    in_progress: 'En Progreso',
    resolved: 'Resuelto',
  }

  const STATUS_CLASSES: Record<string, string> = {
    open: 'bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan',
    in_progress: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    resolved: 'bg-green-500/10 border-green-500/20 text-green-400',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Tickets List */}
      <div className="lg:col-span-1 space-y-6">
        {/* Create Ticket Trigger */}
        <div className="bg-[#121219] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Abrir Ticket de Soporte</h3>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Asunto</label>
              <input
                type="text"
                required
                placeholder="Ej. Problema con evidencias en ronda 2"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white font-medium"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-white/40">Descripción / Mensaje</label>
              <textarea
                rows={4}
                required
                placeholder="Describe el inconveniente en detalle..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white font-medium resize-none leading-relaxed"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] rounded-xl font-semibold leading-relaxed">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] rounded-xl font-semibold leading-relaxed">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={creatingTicket}
              className="w-full bg-neon-cyan text-black font-black uppercase tracking-widest text-xs py-3.5 rounded-xl hover:bg-[#00D1DB] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creatingTicket ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creando...
                </>
              ) : (
                'Crear Ticket'
              )}
            </button>
          </form>
        </div>

        {/* Existing Tickets List */}
        <div className="bg-[#121219] border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Mis Tickets</h3>
          {tickets.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-white/5 rounded-xl text-white/20 text-xs italic">
              No tienes ningún ticket abierto.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadTicketDetails(t.id)}
                  className={`w-full p-4 text-left border rounded-xl transition-all flex flex-col gap-2 ${
                    selectedTicketId === t.id
                      ? 'bg-neon-cyan/5 border-neon-cyan/30'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-xs font-bold text-white truncate max-w-[150px]">{t.subject}</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${STATUS_CLASSES[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-white/30">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Actualizado: {new Date(t.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Details & Chat Panel */}
      <div className="lg:col-span-2">
        {!selectedTicketId ? (
          <div className="py-24 text-center border border-dashed border-white/5 bg-[#121219]/20 rounded-3xl text-white/20 uppercase tracking-widest text-sm font-bold flex flex-col items-center justify-center gap-4">
            <Ticket className="w-10 h-10 text-white/10" />
            <span>Selecciona un ticket para ver la conversación</span>
          </div>
        ) : fetchingDetails ? (
          <div className="py-24 text-center border border-dashed border-white/5 bg-[#121219]/20 rounded-3xl text-white/20 uppercase tracking-widest text-sm font-bold flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-neon-cyan animate-spin" />
            <span>Cargando conversación...</span>
          </div>
        ) : selectedTicket ? (
          <div className="bg-[#121219] border border-white/5 rounded-2xl flex flex-col min-h-[500px]">
            {/* Thread Header */}
            <div className="px-6 py-4.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedTicket.subject}</h3>
                <div className="flex items-center gap-3.5 text-[10px] text-white/40 mt-1">
                  <span className={`px-2 py-0.5 rounded font-black uppercase tracking-widest border ${STATUS_CLASSES[selectedTicket.status]}`}>
                    {STATUS_LABELS[selectedTicket.status]}
                  </span>
                  <span>Creado: {new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
              </div>

              {selectedTicket.status !== 'resolved' && (
                <button
                  onClick={handleCloseTicket}
                  className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Marcar Resuelto
                </button>
              )}
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 p-6 space-y-4 max-h-[400px] overflow-y-auto bg-black/20">
              {messages.map((msg) => {
                const isAdminMsg = msg.sender?.role === 'ADMIN' || msg.sender?.role === 'SUPER_ADMIN' || msg.sender?.role === 'KRONIX_STAFF'
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[80%] ${
                      isAdminMsg ? 'mr-auto items-start' : 'ml-auto items-end'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-white/40">
                        {isAdminMsg ? 'Soporte Kronix' : msg.sender?.username || 'Tú'}
                      </span>
                      <span className="text-[9px] text-white/20">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isAdminMsg
                        ? 'bg-white/5 border border-white/5 rounded-tl-none text-white/90'
                        : 'bg-neon-cyan/10 border border-neon-cyan/20 rounded-tr-none text-white'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Reply Area */}
            {selectedTicket.status === 'resolved' ? (
              <div className="p-6 bg-green-500/5 text-center text-xs text-green-400 font-semibold border-t border-white/5 rounded-b-2xl">
                Este ticket ha sido resuelto. Si necesitas más ayuda, puedes abrir un nuevo ticket.
              </div>
            ) : (
              <form onSubmit={handleReply} className="p-4 bg-white/[0.01] border-t border-white/5 flex gap-3 rounded-b-2xl">
                <input
                  type="text"
                  required
                  placeholder="Escribe tu respuesta aquí..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-neon-cyan transition-all text-white font-medium"
                />
                <button
                  type="submit"
                  disabled={replying || !replyText.trim()}
                  className="p-3 bg-neon-cyan text-black rounded-xl hover:bg-[#00D1DB] transition-all disabled:opacity-50 shrink-0 flex items-center justify-center"
                >
                  {replying ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
