'use client'

import { useTransition } from 'react'
import { changeUserRole } from '@/lib/actions/admin'

interface RoleSelectProps {
  userId: string
  currentRole: string
}

const ROLE_LABELS: Record<string, string> = {
  USER: 'USER — Jugador estándar',
  STREAMER: 'STREAMER — Creador de torneos',
  FEDERATION: 'FEDERATION — Gestor oficial',
  KRONIX_STAFF: 'KRONIX STAFF — Soporte Kronix',
  ADMIN: 'ADMIN — Administrador',
  SUPER_ADMIN: 'SUPER ADMIN — Acceso total',
}

export function RoleSelect({ userId, currentRole }: RoleSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value
    if (!confirm(`¿Cambiar el rol de este usuario a "${ROLE_LABELS[newRole] ?? newRole}"?`)) return
    const formData = new FormData()
    formData.set('userId', userId)
    formData.set('role', newRole)
    startTransition(async () => {
      await changeUserRole(formData)
    })
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={isPending}
      className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-neon-cyan/50 cursor-pointer disabled:opacity-40"
    >
      <option value="USER">USER</option>
      <option value="STREAMER">STREAMER</option>
      <option value="FEDERATION">FEDERATION</option>
      <option value="KRONIX_STAFF">KRONIX STAFF</option>
      <option value="ADMIN">ADMIN</option>
      <option value="SUPER_ADMIN">SUPER ADMIN</option>
    </select>
  )
}
