'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishTournament } from '@/lib/actions/tournaments'

export function PublishTournamentButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handlePublish() {
    startTransition(async () => {
      const res = await publishTournament(id)
      if ('error' in res) {
        alert(res.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={handlePublish}
      disabled={isPending}
      className="px-5 py-2.5 rounded-xl bg-neon-cyan text-black text-sm font-black uppercase tracking-wider
        hover:bg-[#00D1DB] transition-all disabled:opacity-40"
    >
      {isPending ? 'Publicando...' : '📣 Publicar torneo'}
    </button>
  )
}
