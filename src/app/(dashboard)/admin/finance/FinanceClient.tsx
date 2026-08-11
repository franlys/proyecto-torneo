'use client'

import { useState, useMemo } from 'react'
import {
  TrendingUp,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  DollarSign,
  Trophy,
  Dices,
  Receipt,
  Search,
  ExternalLink,
  Check,
  X,
  Loader2
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { approveWithdrawalAction, rejectWithdrawalAction } from '@/lib/actions/withdrawals'
import { toast } from 'sonner'

interface WithdrawalRecord {
  id: string
  user_id: string
  amount: string | number
  usd_amount: string | number
  paypal_email: string
  status: 'pending' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
  profiles: {
    username: string | null
    email: string | null
  } | null
}

interface CoinTx {
  id: string
  user_id: string
  amount: string | number
  type: string
  description: string | null
  reference_id: string | null
  created_at: string
  profiles?: any
}

interface FinanceClientProps {
  tourneyNetRevenue: number
  tourneyTotalRevenue: number
  tourneyTotalPrizes: number
  raffleNetRevenue: number
  totalCirculatingCoins: number
  withdrawals: WithdrawalRecord[]
  completedDeposits: { amount: string | number; created_at: string }[]
  tournamentFinancials: any[]
  userBets: any[]
  totalBetVolume: number
  totalBetWonPayouts: number
  betsHouseNet: number
  totalVipRevenueUSD: number
  coinTransactions: CoinTx[]
}

export function FinanceClient({
  tourneyNetRevenue,
  tourneyTotalRevenue,
  tourneyTotalPrizes,
  raffleNetRevenue,
  totalCirculatingCoins,
  withdrawals,
  completedDeposits,
  tournamentFinancials,
  userBets,
  totalBetVolume,
  totalBetWonPayouts,
  betsHouseNet,
  totalVipRevenueUSD,
  coinTransactions
}: FinanceClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'withdrawals' | 'tournaments' | 'bets' | 'ledger'>('overview')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')
  const [txFilter, setTxFilter] = useState<string>('all')
  const [txSearch, setTxSearch] = useState<string>('')
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null)

  // Calculations
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed')
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending')
  const totalWithdrawnUSD = completedWithdrawals.reduce((sum, w) => sum + Number(w.usd_amount), 0)
  const totalDepositsUSD = completedDeposits.reduce((sum, d) => sum + Number(d.amount), 0)

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter(w => {
    if (statusFilter === 'all') return true
    return w.status === statusFilter
  })

  // Filtered Coin Transactions
  const filteredTransactions = useMemo(() => {
    return coinTransactions.filter(tx => {
      // Type filter
      if (txFilter !== 'all') {
        if (txFilter === 'deposits' && tx.type !== 'deposit') return false
        if (txFilter === 'withdrawals' && tx.type !== 'withdrawal') return false
        if (txFilter === 'tournaments' && tx.type !== 'tournament_entry') return false
        if (txFilter === 'prizes' && !['podium_prize', 'mvp_prize', 'tournament_payout', 'raffle_prize'].includes(tx.type)) return false
        if (txFilter === 'bets' && !['bet_placed', 'bet_payout'].includes(tx.type)) return false
        if (txFilter === 'refunds' && !['refund', 'tournament_refund'].includes(tx.type)) return false
      }
      // Search filter
      if (txSearch.trim()) {
        const query = txSearch.toLowerCase()
        const userProf = Array.isArray(tx.profiles) ? tx.profiles[0] : tx.profiles
        const username = userProf?.username?.toLowerCase() || ''
        const email = userProf?.email?.toLowerCase() || ''
        const desc = tx.description?.toLowerCase() || ''
        if (!username.includes(query) && !email.includes(query) && !desc.includes(query)) {
          return false
        }
      }
      return true
    })
  }, [coinTransactions, txFilter, txSearch])

  // Recharts Monthly Data
  const monthlyData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const dataMap: Record<string, { name: string; Depositos: number; Retiros: number }> = {}

    const currentYear = new Date().getFullYear()
    months.forEach((m, index) => {
      const key = `${currentYear}-${String(index + 1).padStart(2, '0')}`
      dataMap[key] = { name: m, Depositos: 0, Retiros: 0 }
    })

    completedDeposits.forEach(d => {
      const date = new Date(d.created_at)
      if (date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (dataMap[key]) dataMap[key].Depositos += Number(d.amount)
      }
    })

    completedWithdrawals.forEach(w => {
      const date = new Date(w.created_at)
      if (date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (dataMap[key]) dataMap[key].Retiros += Number(w.usd_amount)
      }
    })

    return Object.values(dataMap)
  }, [completedDeposits, completedWithdrawals])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleApproveWithdrawal = async (w: WithdrawalRecord) => {
    if (!confirm(`¿Confirmas que ya enviaste $${w.usd_amount} USD a ${w.paypal_email} o deseas aprobar este retiro?`)) return
    setLoadingActionId(w.id)
    try {
      const res = await approveWithdrawalAction(w.id)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('¡Retiro completado y notificado al usuario!')
        window.location.reload()
      }
    } catch (err) {
      toast.error('Error al aprobar el retiro')
    } finally {
      setLoadingActionId(null)
    }
  }

  const handleRejectWithdrawal = async (w: WithdrawalRecord) => {
    const reason = prompt('Motivo del rechazo (se reembolsarán los K-Coins al usuario):')
    if (!reason) return
    setLoadingActionId(w.id)
    try {
      const res = await rejectWithdrawalAction(w.id, reason)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('Retiro rechazado y K-Coins reembolsados al usuario.')
        window.location.reload()
      }
    } catch (err) {
      toast.error('Error al rechazar el retiro')
    } finally {
      setLoadingActionId(null)
    }
  }

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'deposit':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 border border-green-500/20 text-green-400">Depósito / Recarga</span>
      case 'withdrawal':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400">Retiro</span>
      case 'tournament_entry':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">Inscripción Torneo</span>
      case 'podium_prize':
      case 'mvp_prize':
      case 'tournament_payout':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">Premio Pagado</span>
      case 'bet_placed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400">Apuesta Realizada</span>
      case 'bet_payout':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Ganancia Apuesta</span>
      case 'tournament_refund':
      case 'refund':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">Reembolso</span>
      case 'vip_purchase':
      case 'subscription':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">Membresía VIP</span>
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 border border-white/10 text-white/70">{type}</span>
    }
  }

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas Totales */}
        <div className="p-5 rounded-2xl bg-dark-card border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs font-bold uppercase tracking-wider">
            <span>Depósitos Totales</span>
            <ArrowUpRight size={16} className="text-green-400" />
          </div>
          <div className="text-2xl font-black font-orbitron text-white">
            ${totalDepositsUSD.toLocaleString('es-DO', { minimumFractionDigits: 2 })} <span className="text-xs text-white/40 font-normal">USD</span>
          </div>
          <p className="text-[11px] text-white/40">Recargas de saldo vía PayPal</p>
        </div>

        {/* Salidas Totales / Retiros */}
        <div className="p-5 rounded-2xl bg-dark-card border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs font-bold uppercase tracking-wider">
            <span>Retiros Enviados</span>
            <ArrowDownLeft size={16} className="text-red-400" />
          </div>
          <div className="text-2xl font-black font-orbitron text-white">
            ${totalWithdrawnUSD.toLocaleString('es-DO', { minimumFractionDigits: 2 })} <span className="text-xs text-white/40 font-normal">USD</span>
          </div>
          <p className="text-[11px] text-white/40">
            {pendingWithdrawals.length > 0 ? (
              <span className="text-amber-400 font-bold">⚠️ {pendingWithdrawals.length} retiros pendientes</span>
            ) : (
              'Retiros completados'
            )}
          </p>
        </div>

        {/* Economía de Torneos */}
        <div className="p-5 rounded-2xl bg-dark-card border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs font-bold uppercase tracking-wider">
            <span>Premios de Torneos</span>
            <Trophy size={16} className="text-yellow-400" />
          </div>
          <div className="text-2xl font-black font-orbitron text-yellow-400">
            ${tourneyTotalPrizes.toLocaleString('es-DO', { minimumFractionDigits: 2 })} <span className="text-xs text-white/40 font-normal">USD</span>
          </div>
          <p className="text-[11px] text-white/40">Recaudado: ${tourneyTotalRevenue.toFixed(2)} USD</p>
        </div>

        {/* Economía de Apuestas */}
        <div className="p-5 rounded-2xl bg-dark-card border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs font-bold uppercase tracking-wider">
            <span>Margen de Apuestas</span>
            <Dices size={16} className="text-neon-cyan" />
          </div>
          <div className={`text-2xl font-black font-orbitron ${betsHouseNet >= 0 ? 'text-neon-cyan' : 'text-red-400'}`}>
            🪙 {betsHouseNet.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-white/40">
            Volumen: 🪙 {totalBetVolume.toLocaleString('es-DO')} | Premios: 🪙 {totalBetWonPayouts.toLocaleString('es-DO')}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {[
          { id: 'overview', label: '📊 Resumen & Gráficos' },
          { id: 'withdrawals', label: `💸 Retiros PayPal (${pendingWithdrawals.length > 0 ? `⚠️ ${pendingWithdrawals.length}` : withdrawals.length})` },
          { id: 'tournaments', label: `🏆 Economía de Torneos (${tournamentFinancials.length})` },
          { id: 'bets', label: `🎲 Apuestas & Predicciones (${userBets.length})` },
          { id: 'ledger', label: `📒 Libro Diario Contable (${coinTransactions.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? 'bg-neon-cyan text-black shadow-lg shadow-neon-cyan/20'
                : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-dark-card border border-white/5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Flujo Mensual de Fondos (USD)</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="name" stroke="#ffffff40" fontSize={11} />
                  <YAxis stroke="#ffffff40" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0B0D12', borderColor: '#ffffff20', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="Depositos" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorDeposits)" />
                  <Area type="monotone" dataKey="Retiros" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorWithdrawals)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Metrics Breakdown */}
          <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-4 flex flex-col justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Resumen de Circulación</h3>
            
            <div className="space-y-3">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                <span className="text-xs text-white/60">K-Coins en Circulación</span>
                <span className="text-sm font-bold text-yellow-400 font-orbitron">🪙 {totalCirculatingCoins.toLocaleString('es-DO')}</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                <span className="text-xs text-white/60">Comisión Neta Torneos</span>
                <span className="text-sm font-bold text-neon-cyan font-orbitron">+${tourneyNetRevenue.toFixed(2)} USD</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                <span className="text-xs text-white/60">Venta de Boletos Sorteos</span>
                <span className="text-sm font-bold text-purple-400 font-orbitron">RD$ {raffleNetRevenue.toLocaleString('es-DO')}</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                <span className="text-xs text-white/60">Ingresos Membresías VIP</span>
                <span className="text-sm font-bold text-amber-400 font-orbitron">${totalVipRevenueUSD.toFixed(2)} USD</span>
              </div>
            </div>

            <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl text-center">
              <span className="text-[11px] text-neon-cyan font-bold block">1 K-Coin = 1 DOP</span>
              <span className="text-[10px] text-white/40">Conversión a USD automática en tiempo real</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WITHDRAWALS */}
      {activeTab === 'withdrawals' && (
        <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Historial y Gestión de Retiros</h3>
              <p className="text-xs text-white/40 mt-1">Aprueba o envía los fondos solicitados por los usuarios</p>
            </div>
            
            {/* Filters */}
            <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5 self-start">
              {['all', 'pending', 'completed', 'failed'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                    statusFilter === filter
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {filter === 'all' ? 'Todos' : filter === 'pending' ? 'Pendientes' : filter === 'completed' ? 'Completados' : 'Rechazados'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/40 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Correo PayPal</th>
                  <th className="py-3 px-4">K-Coins</th>
                  <th className="py-3 px-4">Monto USD</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-white/30">
                      No se encontraron registros de retiros para este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {w.profiles?.username || 'Desconocido'}<br />
                        <span className="text-[10px] text-white/40 font-normal">{w.profiles?.email || '-'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-white/80 font-mono">{w.paypal_email}</td>
                      <td className="py-3.5 px-4 font-bold font-orbitron text-yellow-400">🪙 {Number(w.amount).toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-bold text-white">${Number(w.usd_amount).toFixed(2)} USD</td>
                      <td className="py-3.5 px-4 text-white/40">{formatDate(w.created_at)}</td>
                      <td className="py-3.5 px-4">
                        {w.status === 'completed' && <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full font-bold text-[10px]">Completado</span>}
                        {w.status === 'pending' && <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full font-bold text-[10px]">Pendiente</span>}
                        {w.status === 'failed' && <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full font-bold text-[10px]">Rechazado</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {w.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href="https://www.paypal.com/myaccount/transfer/homepage/buy/preview"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-[#0070ba]/20 hover:bg-[#0070ba]/40 border border-[#0070ba]/40 text-[#009cde] rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                              title={`Enviar $${w.usd_amount} USD a ${w.paypal_email}`}
                            >
                              <span>Pagar en PayPal</span>
                              <ExternalLink size={10} />
                            </a>
                            <button
                              disabled={loadingActionId === w.id}
                              onClick={() => handleApproveWithdrawal(w)}
                              className="px-2.5 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {loadingActionId === w.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={12} />}
                              <span>Aprobar</span>
                            </button>
                            <button
                              disabled={loadingActionId === w.id}
                              onClick={() => handleRejectWithdrawal(w)}
                              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              <X size={12} />
                              <span>Rechazar</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/20 uppercase font-bold">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TOURNAMENTS */}
      {activeTab === 'tournaments' && (
        <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Desglose Económico de Torneos</h3>
            <p className="text-xs text-white/40 mt-1">Recaudación por cuotas de inscripción, premios y comisiones</p>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/40 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Torneo</th>
                  <th className="py-3 px-4">Recaudado</th>
                  <th className="py-3 px-4">Premios Podio</th>
                  <th className="py-3 px-4">Premio MVP</th>
                  <th className="py-3 px-4">Payout Organizador</th>
                  <th className="py-3 px-4">Payout Streamer</th>
                  <th className="py-3 px-4 text-right">Comisión Kronix</th>
                </tr>
              </thead>
              <tbody>
                {tournamentFinancials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-white/30">
                      No hay reportes de torneos finalizados aún.
                    </td>
                  </tr>
                ) : (
                  tournamentFinancials.map((f: any) => {
                    const rev = Number(f.total_revenue || 0)
                    const prizes = Number(f.total_prizes || 0)
                    const mvp = Number(f.mvp_prize || 0)
                    const orgPayout = Number(f.organizer_payout || 0)
                    const strPayout = Number(f.streamer_payout || 0)
                    const remainder = Number(f.remainder || 0)
                    const platformCut = remainder - orgPayout - strPayout

                    return (
                      <tr key={f.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">{f.tournaments?.name || 'Torneo'}</td>
                        <td className="py-3.5 px-4 font-mono text-white">${rev.toFixed(2)} USD</td>
                        <td className="py-3.5 px-4 font-mono text-yellow-400">${prizes.toFixed(2)} USD</td>
                        <td className="py-3.5 px-4 font-mono text-amber-400">${mvp.toFixed(2)} USD</td>
                        <td className="py-3.5 px-4 font-mono text-white/70">${orgPayout.toFixed(2)} USD</td>
                        <td className="py-3.5 px-4 font-mono text-white/70">${strPayout.toFixed(2)} USD</td>
                        <td className="py-3.5 px-4 font-bold font-orbitron text-neon-cyan text-right">+${platformCut.toFixed(2)} USD</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BETS */}
      {activeTab === 'bets' && (
        <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-bold block">Volumen Total Apostado</span>
              <span className="text-xl font-bold text-white font-orbitron mt-1 block">🪙 {totalBetVolume.toLocaleString('es-DO')} K-Coins</span>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-bold block">Premios Pagados a Ganadores</span>
              <span className="text-xl font-bold text-yellow-400 font-orbitron mt-1 block">🪙 {totalBetWonPayouts.toLocaleString('es-DO')} K-Coins</span>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-[10px] text-white/40 uppercase font-bold block">Ganancia Neta de la Plataforma</span>
              <span className={`text-xl font-bold font-orbitron mt-1 block ${betsHouseNet >= 0 ? 'text-neon-cyan' : 'text-red-400'}`}>
                🪙 {betsHouseNet.toLocaleString('es-DO')} K-Coins
              </span>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/40 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Monto Apostado</th>
                  <th className="py-3 px-4">Cuota (Odds)</th>
                  <th className="py-3 px-4">Retorno Potencial</th>
                  <th className="py-3 px-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {userBets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-white/30">
                      No hay apuestas registradas en el sistema.
                    </td>
                  </tr>
                ) : (
                  userBets.slice(0, 50).map((b: any) => (
                    <tr key={b.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 px-4 text-white/40">{formatDate(b.created_at)}</td>
                      <td className="py-3.5 px-4 font-bold font-orbitron text-purple-400">🪙 {Number(b.amount).toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-mono text-white/80">x{Number(b.odds).toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-mono text-yellow-400">🪙 {Number(b.potential_payout).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right">
                        {b.status === 'won' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400">Ganada</span>}
                        {b.status === 'lost' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400">Perdida</span>}
                        {b.status === 'pending' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400">En Juego</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: GENERAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Libro Diario Contable</h3>
              <p className="text-xs text-white/40 mt-1">Auditoría en tiempo real de todos los movimientos de K-Coins</p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Buscar usuario o concepto..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-neon-cyan"
              />
            </div>
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'deposits', label: 'Depósitos / Recargas' },
              { id: 'withdrawals', label: 'Retiros' },
              { id: 'tournaments', label: 'Inscripciones Torneos' },
              { id: 'prizes', label: 'Premios Pagados' },
              { id: 'bets', label: 'Apuestas' },
              { id: 'refunds', label: 'Reembolsos' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTxFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  txFilter === f.id
                    ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan'
                    : 'bg-white/5 border border-white/5 text-white/40 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/40 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Descripción / Concepto</th>
                  <th className="py-3 px-4 text-right">Monto (K-Coins)</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-white/30">
                      No se encontraron transacciones con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPositive = Number(tx.amount) > 0
                    const userProf = Array.isArray(tx.profiles) ? tx.profiles[0] : tx.profiles
                    const username = userProf?.username || 'Usuario'
                    const email = userProf?.email || '-'
                    return (
                      <tr key={tx.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                        <td className="py-3 px-4 text-white/40 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                        <td className="py-3 px-4 font-bold text-white">
                          {username}<br />
                          <span className="text-[10px] text-white/40 font-normal">{email}</span>
                        </td>
                        <td className="py-3 px-4">{getTxTypeBadge(tx.type)}</td>
                        <td className="py-3 px-4 text-white/70 max-w-[280px] truncate" title={tx.description || ''}>
                          {tx.description || '-'}
                        </td>
                        <td className={`py-3 px-4 font-bold font-orbitron text-right whitespace-nowrap ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? `+${Number(tx.amount).toFixed(2)}` : Number(tx.amount).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
