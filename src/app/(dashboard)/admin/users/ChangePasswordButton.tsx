'use client'

import { useState } from 'react'
import { Key, Loader2 } from 'lucide-react'
import { changeUserPasswordAction } from '@/lib/actions/admin'

interface ChangePasswordButtonProps {
  userId: string
  userEmail: string
}

export function ChangePasswordButton({ userId, userEmail }: ChangePasswordButtonProps) {
  const [isPending, setIsPending] = useState(false)

  const handleReset = async () => {
    const password = window.prompt(`Ingresa la nueva contraseña para el usuario ${userEmail}:`)
    if (password === null) return // Cancelled by user
    
    const trimmed = password.trim()
    if (trimmed.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setIsPending(true)
    try {
      const res = await changeUserPasswordAction(userId, trimmed)
      if ('error' in res && res.error) {
        alert(`Error al cambiar la contraseña: ${res.error}`)
      } else {
        alert('¡La contraseña ha sido cambiada exitosamente!')
      }
    } catch (err: any) {
      alert(`Error inesperado: ${err.message || 'Error desconocido'}`)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleReset}
      disabled={isPending}
      title="Cambiar contraseña de este usuario"
      type="button"
      className="p-1.5 text-white/40 hover:text-neon-cyan hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
    >
      {isPending ? (
        <Loader2 size={14} className="animate-spin text-neon-cyan" />
      ) : (
        <Key size={14} />
      )}
    </button>
  )
}
