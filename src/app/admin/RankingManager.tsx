'use client'

import { useState } from 'react'
import { updateNationalRankingPlayer, type GameDiscipline } from '@/lib/actions/federation'
import { useRouter } from 'next/navigation'

export function RankingManager() {
  const [displayName, setDisplayName] = useState('')
  const [realName, setRealName] = useState('')
  const [discipline, setDiscipline] = useState<GameDiscipline>('clash_royale')
  const [points, setPoints] = useState(0)
  const [tournamentsPlayed, setTournamentsPlayed] = useState(0)
  const [podiumsCount, setPodiumsCount] = useState(0)
  const [winRate, setWinRate] = useState(0.00)
  const [isNationalSelected, setIsNationalSelected] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName) return
    setLoading(true)

    const res = await updateNationalRankingPlayer({
      displayName,
      realName: realName || null,
      discipline,
      points,
      tournamentsPlayed,
      podiumsCount,
      winRate,
      isNationalSelected,
      avatarUrl: avatarUrl || null
    })

    if ('error' in res) {
      alert(res.error)
    } else {
      alert('Jugador registrado/actualizado en el Ranking Nacional.')
      setDisplayName('')
      setRealName('')
      setPoints(0)
      setTournamentsPlayed(0)
      setPodiumsCount(0)
      setWinRate(0.00)
      setIsNationalSelected(false)
      setAvatarUrl('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-[#121219] border border-white/5 rounded-2xl overflow-hidden p-6 space-y-6">
      <div>
        <h3 className="text-white font-bold text-base">Registrar / Actualizar Jugador</h3>
        <p className="text-white/40 text-xs mt-1">Inserta los datos del atleta nacional para actualizar el ranking en vivo.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Nickname (Display Name) *</label>
            <input 
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej: MenaRD"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Nombre Real (Opcional)</label>
            <input 
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="Ej: Saúl Mena"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Disciplina / Juego *</label>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value as GameDiscipline)}
              className="w-full bg-[#121219] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan outline-none"
            >
              <option value="clash_royale">Clash Royale 👑</option>
              <option value="street_fighter_6">Street Fighter 6 🥊</option>
              <option value="super_smash_bros_ultimate">Super Smash Bros 💥</option>
              <option value="free_fire">Free Fire 🔥</option>
              <option value="fortnite">Fortnite ⛏️</option>
              <option value="call_of_duty_mobile">Call of Duty Mobile 🔫</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Puntos FDDE *</label>
            <input 
              type="number"
              required
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[9px] uppercase font-black tracking-widest text-white/40 mb-1.5">Torneos</label>
            <input 
              type="number"
              value={tournamentsPlayed}
              onChange={(e) => setTournamentsPlayed(parseInt(e.target.value) || 0)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white focus:border-neon-cyan outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase font-black tracking-widest text-white/40 mb-1.5">🥇 Podios</label>
            <input 
              type="number"
              value={podiumsCount}
              onChange={(e) => setPodiumsCount(parseInt(e.target.value) || 0)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white focus:border-neon-cyan outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase font-black tracking-widest text-white/40 mb-1.5">Win Rate (%)</label>
            <input 
              type="number"
              step="0.01"
              value={winRate}
              onChange={(e) => setWinRate(parseFloat(e.target.value) || 0.00)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white focus:border-neon-cyan outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Avatar URL (Opcional)</label>
          <input 
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan outline-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input 
            type="checkbox"
            id="national_select"
            checked={isNationalSelected}
            onChange={(e) => setIsNationalSelected(e.target.checked)}
            className="w-4 h-4 accent-neon-cyan bg-white/5 border border-white/10 rounded cursor-pointer"
          />
          <label htmlFor="national_select" className="text-xs font-semibold text-white/70 cursor-pointer">
            Marcar como parte de la Selección Nacional de RD 🇩🇴
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !displayName}
          className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-neon-cyan hover:scale-[1.01] transition-all disabled:opacity-50 mt-4"
        >
          {loading ? 'Guardando...' : 'Guardar y Publicar en Rankings'}
        </button>
      </form>
    </div>
  )
}
