'use client'

import { useTransition } from 'react'
import { deleteUserByAdmin } from '@/lib/actions/admin'
import { Trash2, Loader2 } from 'lucide-react'

interface DeleteUserButtonProps {
  userId: string
  userEmail: string
}

export function DeleteUserButton({ userId, userEmail }: DeleteUserButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${userEmail}? Esta acción borrará su perfil y cuenta de manera irreversible.`)) {
      startTransition(async () => {
        const res = await deleteUserByAdmin(userId)
        if (res && 'error' in res) {
          alert(res.error)
        }
      })
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-40 flex items-center justify-center"
      title="Eliminar usuario"
      type="button"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  )
}
