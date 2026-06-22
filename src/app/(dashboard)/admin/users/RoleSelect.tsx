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
      className="bg-[#1a1a24] border border-white/10 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-neon-cyan/50 cursor-pointer disabled:opacity-40"
      style={{ colorScheme: 'dark' }}
    >
      <option value="USER"        className="bg-[#1a1a24] text-white">USER</option>
      <option value="STREAMER"    className="bg-[#1a1a24] text-white">STREAMER</option>
      <option value="FEDERATION"  className="bg-[#1a1a24] text-white">FEDERATION</option>
      <option value="KRONIX_STAFF" className="bg-[#1a1a24] text-white">KRONIX STAFF</option>
      <option value="ADMIN"       className="bg-[#1a1a24] text-white">ADMIN</option>
      <option value="SUPER_ADMIN" className="bg-[#1a1a24] text-white">SUPER ADMIN</option>
    </select>
  )
}
