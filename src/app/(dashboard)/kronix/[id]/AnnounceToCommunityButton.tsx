'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { announceTournamentToAllUsersAction } from '@/lib/actions/tournaments'

export function AnnounceToCommunityButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const router = useRouter()

  function handleAnnounce() {
    if (!confirm('¿Estás seguro de que deseas anunciar este torneo por correo electrónico a TODOS los usuarios registrados en la plataforma?')) {
      return
    }

    startTransition(async () => {
      const res = await announceTournamentToAllUsersAction(id)
      if ('error' in res) {
        alert(res.error)
      } else {
        setSent(true)
        alert('¡El torneo ha sido anunciado con éxito a todos los jugadores de la plataforma!')
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={handleAnnounce}
      disabled={isPending || sent}
      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-white text-sm font-bold
        hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {isPending ? 'Enviando correos...' : sent ? '✓ Anuncio enviado' : '📣 Enviar anuncio vía Email'}
    </button>
  )
}
