'use client'

import { useState } from 'react'
import {
  TrendingUp,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  FileText,
  DollarSign
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts'

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

interface FinanceClientProps {
  tourneyNetRevenue: number
  raffleNetRevenue: number
  totalCirculatingCoins: number
  withdrawals: WithdrawalRecord[]
  completedDeposits: { amount: string | number; created_at: string }[]
  tournamentFinancials: any[]
}

export function FinanceClient({
  tourneyNetRevenue,
  raffleNetRevenue,
  totalCirculatingCoins,
  withdrawals,
  completedDeposits,
  tournamentFinancials
}: FinanceClientProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')

  // Calculate metrics
  const totalNetRevenue = tourneyNetRevenue + (raffleNetRevenue / 58.25) // convert DOP raffle revenue to approximate USD for total view
  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed')
  const failedWithdrawals = withdrawals.filter(w => w.status === 'failed')
  
  const totalWithdrawnUSD = completedWithdrawals.reduce((sum, w) => sum + Number(w.usd_amount), 0)
  const totalFailedWithdrawalsCount = failedWithdrawals.length
  const totalCompletedWithdrawalsCount = completedWithdrawals.length
  
  const totalDepositsUSD = completedDeposits.reduce((sum, d) => sum + Number(d.amount), 0)

  // Filtered withdrawals
  const filteredWithdrawals = withdrawals.filter(w => {
    if (statusFilter === 'all') return true
    return w.status === statusFilter
  })

  // Format Recharts Chart Data (Deposits vs Withdrawals by Month)
  const getMonthlyData = () => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const dataMap: Record<string, { name: string; Depositos: number; Retiros: number }> = {}

    // Initialize months
    const currentYear = new Date().getFullYear()
    months.forEach((m, index) => {
      const key = `${currentYear}-${String(index + 1).padStart(2, '0')}`
      dataMap[key] = { name: m, Depositos: 0, Retiros: 0 }
    })

    // Populate deposits
    completedDeposits.forEach(d => {
      const date = new Date(d.created_at)
      if (date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (dataMap[key]) {
          dataMap[key].Depositos += Number(d.amount)
        }
      }
    })

    // Populate withdrawals
    completedWithdrawals.forEach(w => {
      const date = new Date(w.created_at)
      if (date.getFullYear() === currentYear) {
        const key = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (dataMap[key]) {
          dataMap[key].Retiros += Number(w.usd_amount)
        }
      }
    })

    return Object.values(dataMap)
  }

  const chartData = getMonthlyData()

  const getStatusBadge = (status: 'pending' | 'completed' | 'failed') => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/10">
            <CheckCircle size={10} /> Completado
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/10">
            <AlertCircle size={10} /> Fallido
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/10">
            <HelpCircle size={10} /> Pendiente
          </span>
        )
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-8 text-left">
      {/* Cards Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Net Revenue Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-dark-card to-[#121217] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/30">Ingresos Totales (Est.)</span>
            <DollarSign className="w-5 h-5 text-neon-cyan" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-orbitron font-black text-white">${totalNetRevenue.toFixed(2)} USD</h2>
            <p className="text-[10px] text-white/40 leading-relaxed">
              Comisión Torneos: <span className="text-white">${tourneyNetRevenue.toFixed(2)} USD</span><br />
              Venta de Rifas: <span className="text-white">RD$ {raffleNetRevenue.toFixed(2)} DOP</span>
            </p>
          </div>
        </div>

        {/* Circulating Coins Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-dark-card to-[#121217] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/30">K-Coins en Circulación</span>
            <Coins className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-orbitron font-black text-white">{totalCirculatingCoins.toFixed(2)}</h2>
            <p className="text-[10px] text-white/40 leading-relaxed">
              Equivalente real en Dop/Usd:<br />
              <span className="text-white">RD$ {totalCirculatingCoins.toFixed(2)} DOP</span>
            </p>
          </div>
        </div>

        {/* Successful Payouts Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-dark-card to-[#121217] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/30">Retiros de PayPal</span>
            <ArrowUpRight className="w-5 h-5 text-green-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-orbitron font-black text-white">${totalWithdrawnUSD.toFixed(2)} USD</h2>
            <p className="text-[10px] text-white/40 leading-relaxed">
              Completados: <span className="text-green-400 font-bold">{totalCompletedWithdrawalsCount}</span> / Fallidos: <span className="text-red-400 font-bold">{totalFailedWithdrawalsCount}</span>
            </p>
          </div>
        </div>

        {/* Total Deposits Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-dark-card to-[#121217] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/30">Depósitos Totales (Vía PayPal)</span>
            <ArrowDownLeft className="w-5 h-5 text-purple-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-orbitron font-black text-white">${totalDepositsUSD.toFixed(2)} USD</h2>
            <p className="text-[10px] text-white/40 leading-relaxed">
              Capital total invertido por usuarios para K-Coins.
            </p>
          </div>
        </div>
      </div>

      {/* Graph Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-dark-card border border-white/5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Flujo Mensual: Depósitos vs Retiros (USD)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#121219', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="Depositos" fill="#a855f7" name="Depósitos (USD)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Retiros" fill="#10b981" name="Retiros (USD)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tournament Financials list */}
        <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-4 flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Comisiones por Torneos</h3>
          <div className="flex-1 overflow-y-auto space-y-3 max-h-[300px] pr-2 scrollbar-thin">
            {tournamentFinancials.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-12">No hay reportes de torneos finalizados.</p>
            ) : (
              tournamentFinancials.map((f: any) => {
                const remainder = Number(f.remainder || 0)
                const orgPayout = Number(f.organizer_payout || 0)
                const strPayout = Number(f.streamer_payout || 0)
                const platformCut = remainder - orgPayout - strPayout

                return (
                  <div key={f.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{f.tournaments?.name || 'Torneo'}</span>
                      <span className="text-[10px] text-white/40 block">Recaudado: ${Number(f.total_revenue).toFixed(2)} USD</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-neon-cyan font-orbitron block">+${platformCut.toFixed(2)}</span>
                      <span className="text-[9px] text-white/30 block uppercase font-bold">Comisión</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Payouts Log Table */}
      <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Historial de Retiros de PayPal</h3>
          
          {/* Filters */}
          <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5 self-start">
            {['all', 'completed', 'failed', 'pending'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  statusFilter === filter
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {filter === 'all' ? 'Todos' : filter === 'completed' ? 'Completos' : filter === 'failed' ? 'Fallidos' : 'Pendientes'}
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
                <th className="py-3 px-4">Detalle / Error</th>
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
                    <td className="py-3.5 px-4 text-white/70 font-mono">{w.paypal_email}</td>
                    <td className="py-3.5 px-4 font-bold font-orbitron text-yellow-400">🪙 {Number(w.amount).toFixed(2)}</td>
                    <td className="py-3.5 px-4 font-bold text-white">${Number(w.usd_amount).toFixed(2)} USD</td>
                    <td className="py-3.5 px-4 text-white/40">{formatDate(w.created_at)}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(w.status)}</td>
                    <td className="py-3.5 px-4 text-red-400/80 font-mono text-[10px] max-w-[200px] truncate" title={w.error_message || ''}>
                      {w.error_message || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
