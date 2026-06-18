'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { upsertGameAccount, deleteGameAccount, GAME_LABELS } from '@/lib/actions/game-accounts'
import { toast } from 'sonner'

interface GameAccount {
  id: string
  game: string
  game_id: string
  game_username: string
}

interface GameAccountsSectionProps {
  initialAccounts: GameAccount[]
}

export function GameAccountsSection({ initialAccounts }: GameAccountsSectionProps) {
  const [accounts, setAccounts] = useState<GameAccount[]>(initialAccounts)
  const [editingGame, setEditingGame] = useState<string | null>(null)
  const [gameId, setGameId] = useState('')
  const [gameUsername, setGameUsername] = useState('')
  const [isPending, startTransition] = useTransition()

  const openEditor = (game: string) => {
    const existing = accounts.find(a => a.game === game)
    setGameId(existing?.game_id || '')
    setGameUsername(existing?.game_username || '')
    setEditingGame(game)
  }

  const handleSave = () => {
    if (!editingGame) return
    const trimId = gameId.trim()
    const trimUsername = gameUsername.trim()
    if (!trimId || !trimUsername) {
      toast.error('Debes completar ambos campos.')
      return
    }

    startTransition(async () => {
      const res = await upsertGameAccount({ game: editingGame, gameId: trimId, gameUsername: trimUsername })
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('¡Cuenta de juego guardada!')
        // Update local state
        setAccounts(prev => {
          const exists = prev.find(a => a.game === editingGame)
          if (exists) {
            return prev.map(a => a.game === editingGame ? { ...a, game_id: trimId, game_username: trimUsername } : a)
          }
          return [...prev, { id: Date.now().toString(), game: editingGame, game_id: trimId, game_username: trimUsername }]
        })
        setEditingGame(null)
      }
    })
  }

  const handleDelete = (game: string) => {
    startTransition(async () => {
      const res = await deleteGameAccount(game)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success('Cuenta eliminada.')
        setAccounts(prev => prev.filter(a => a.game !== game))
      }
    })
  }

  const games = Object.keys(GAME_LABELS)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {games.map(game => {
          const meta = GAME_LABELS[game]
          const linked = accounts.find(a => a.game === game)
          return (
            <div
              key={game}
              className={`relative p-4 rounded-xl border transition-all ${
                linked
                  ? 'bg-neon-cyan/5 border-neon-cyan/20 hover:border-neon-cyan/40'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white uppercase tracking-wide truncate">{meta.label}</p>
                    {linked ? (
                      <div className="mt-0.5">
                        <p className="text-[11px] text-neon-cyan/80 font-mono truncate">{linked.game_id}</p>
                        <p className="text-[11px] text-white/50 truncate">{linked.game_username}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/30 mt-0.5">No vinculada</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => openEditor(game)}
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-neon-cyan/10 hover:text-neon-cyan border border-white/5 hover:border-neon-cyan/20 transition-all text-white/60"
                  >
                    {linked ? 'Editar' : '+ Vincular'}
                  </button>
                  {linked && (
                    <button
                      onClick={() => handleDelete(game)}
                      disabled={isPending}
                      className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all text-white/30"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setEditingGame(null) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-[#0d0d0f] border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="h-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple" />
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{GAME_LABELS[editingGame]?.icon}</span>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wide">{GAME_LABELS[editingGame]?.label}</h3>
                    <p className="text-[11px] text-white/40">Vincula tu cuenta de juego</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">
                      {GAME_LABELS[editingGame]?.idLabel}
                    </label>
                    <input
                      type="text"
                      value={gameId}
                      onChange={e => setGameId(e.target.value)}
                      placeholder={GAME_LABELS[editingGame]?.idPlaceholder}
                      className="w-full bg-black/50 border border-white/10 focus:border-neon-cyan/50 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-white/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1.5">
                      {GAME_LABELS[editingGame]?.usernameLabel}
                    </label>
                    <input
                      type="text"
                      value={gameUsername}
                      onChange={e => setGameUsername(e.target.value)}
                      placeholder={GAME_LABELS[editingGame]?.usernamePlaceholder}
                      className="w-full bg-black/50 border border-white/10 focus:border-neon-cyan/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <button
                    onClick={handleSave}
                    disabled={isPending || !gameId.trim() || !gameUsername.trim()}
                    className="flex-1 py-2.5 bg-neon-cyan hover:bg-neon-cyan/90 text-black text-xs font-black uppercase tracking-widest rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditingGame(null)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
