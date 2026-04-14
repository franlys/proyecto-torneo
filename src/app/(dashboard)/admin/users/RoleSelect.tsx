'use client'

import { useTransition } from 'react'
import { changeUserRole } from '@/lib/actions/admin'

interface RoleSelectProps {
  userId: string
  currentRole: string
}

export function RoleSelect({ userId, currentRole }: RoleSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const formData = new FormData()
    formData.set('userId', userId)
    formData.set('role', e.target.value)
    startTransition(() => changeUserRole(formData))
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
      <option value="ADMIN">ADMIN</option>
    </select>
  )
}
