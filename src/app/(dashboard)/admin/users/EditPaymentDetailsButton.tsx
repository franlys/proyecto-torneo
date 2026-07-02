'use client'

import { useState } from 'react'
import { CreditCard, Loader2, X } from 'lucide-react'
import { updatePaymentDetailsByAdminAction, uploadPaymentQRAction } from '@/lib/actions/admin'

interface EditPaymentDetailsButtonProps {
  userId: string
  userEmail: string
  initialPaymentDetails: string | null
}

export function EditPaymentDetailsButton({
  userId,
  userEmail,
  initialPaymentDetails
}: EditPaymentDetailsButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState(initialPaymentDetails || '')
  const [isPending, setIsPending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleSave = async () => {
    setIsPending(true)
    try {
      const res = await updatePaymentDetailsByAdminAction(userId, paymentDetails.trim() || null)
      if (res && 'error' in res && res.error) {
        alert(`Error al guardar: ${res.error}`)
      } else {
        alert('¡Datos de pago actualizados correctamente!')
        setIsOpen(false)
      }
    } catch (err: any) {
      alert(`Error inesperado: ${err.message || 'Error desconocido'}`)
    } finally {
      setIsPending(false)
    }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadPaymentQRAction(userId, fd)
      if (res && 'error' in res && res.error) {
        alert(`Error al subir imagen: ${res.error}`)
      } else if (res && 'success' in res && res.url) {
        // Append the uploaded image url to the end of payment details
        setPaymentDetails(prev => {
          const suffix = prev.trim() ? '\n\n' : ''
          return prev + suffix + res.url
        })
        alert('¡Imagen de pago subida e insertada exitosamente!')
      }
    } catch (err: any) {
      alert(`Error de red al subir archivo: ${err.message}`)
    } finally {
      setIsUploading(false)
      // Reset input
      e.target.value = ''
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Editar datos de pago del usuario"
        type="button"
        className="p-1.5 text-white/40 hover:text-green-400 hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center"
      >
        <CreditCard size={14} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a24] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="font-orbitron font-bold text-white text-sm uppercase tracking-wide">
                  Datos de Pago
                </h3>
                <p className="text-white/40 text-xs mt-0.5">{userEmail}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                Detalles de cobro / transferencia / links (ej: PayPal.me)
              </label>
              <textarea
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder="Ej: Banco Popular, Cuenta de Ahorros: 123456789, Beneficiario: Juan Pérez..."
                rows={5}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-green-400 placeholder:text-white/15 resize-none"
              />
            </div>

            {/* QR / Image Uploader */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] text-white/40 uppercase tracking-widest font-medium block">
                Subir QR o Imagen de Pago (PayPal / Banco)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadFile}
                  disabled={isUploading || isPending}
                  className="hidden"
                  id={`qr-upload-${userId}`}
                />
                <label
                  htmlFor={`qr-upload-${userId}`}
                  className="px-3 py-2 border border-dashed border-white/10 hover:border-white/30 rounded-xl bg-white/5 text-white/60 hover:text-white text-xs font-semibold cursor-pointer transition-all flex-1 text-center"
                >
                  {isUploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={12} className="animate-spin text-green-400" />
                      Subiendo imagen...
                    </span>
                  ) : (
                    <span>📁 Cargar código QR o Imagen de Pago</span>
                  )}
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all font-orbitron"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || isUploading}
                className="px-4 py-2 rounded-xl text-xs font-bold text-black bg-green-400 hover:bg-green-400/85 disabled:opacity-50 transition-all font-orbitron flex items-center gap-1.5"
              >
                {isPending && <Loader2 size={12} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
