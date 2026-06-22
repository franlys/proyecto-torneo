'use client'

import { useState } from 'react'
import { SubscriptionApprovalForm } from './SubscriptionApprovalForm'
import { DraggableEvidenceModal } from '@/components/ui/DraggableEvidenceModal'

interface SubscriptionsClientProps {
  requests: any[]
}

export function SubscriptionsClient({ requests }: SubscriptionsClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState('')

  return (
    <div className="grid gap-6">
      {!requests || requests.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl text-white/20 uppercase tracking-widest text-sm font-bold">
          No hay solicitudes de suscripción
        </div>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="bg-[#121219] border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row gap-8 items-start">
            {/* Evidence Thumbnail */}
            <div className="w-full md:w-48 aspect-[3/4] bg-white/5 rounded-xl relative overflow-hidden group">
              {req.evidence_url ? (
                <button
                  type="button"
                  onClick={() => {
                    setModalImageUrl(req.evidence_url)
                    setModalOpen(true)
                  }}
                  className="w-full h-full text-left relative block focus:outline-none"
                >
                  <img 
                    src={req.evidence_url} 
                    alt="Evidencia de pago" 
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest text-center px-2">Ampliar Comprobante</span>
                  </div>
                </button>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/10 uppercase text-[10px] font-bold">Sin imagen</div>
              )}
            </div>

            {/* Data & Actions */}
            <div className="flex-1 space-y-4 w-full">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{req.profiles?.username || 'Usuario sin nombre'}</h3>
                  <p className="text-xs text-white/40 font-mono">{req.user_id}</p>
                </div>
                <div className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                  req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 
                  req.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500'
                }`}>
                  {req.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Monto de Pago</span>
                  <span className="text-xl font-black text-neon-cyan">${req.amount}</span>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Fecha de Solicitud</span>
                  <span className="text-sm font-bold uppercase tracking-widest">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {req.status === 'PENDING' && (
                <SubscriptionApprovalForm requestId={req.id} userId={req.user_id} />
              )}
            </div>
          </div>
        ))
      )}

      <DraggableEvidenceModal
        isOpen={modalOpen}
        imageUrl={modalImageUrl}
        onClose={() => setModalOpen(false)}
        title="Comprobante de Pago"
      />
    </div>
  )
}
