'use client'

import React, { useState, useEffect } from 'react'
import Script from 'next/script'
import { Landmark, ArrowUpRight, ArrowDownLeft, History, Loader2, CheckCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { requestWithdrawalAction } from '@/lib/actions/withdrawals'

interface WalletClientProps {
  initialBalance: number
  transactions: any[]
  deposits: any[]
}

export function WalletClient({ initialBalance, transactions, deposits }: WalletClientProps) {
  const [amount, setAmount] = useState<number>(10)
  const [showPayment, setShowPayment] = useState(false)
  const [sdkLoaded, setSdkLoaded] = useState(typeof window !== 'undefined' && !!(window as any).paypal)
  const [isProcessing, setIsProcessing] = useState(false)

  // Thank You modal states
  const [showThankYouModal, setShowThankYouModal] = useState(false)
  const [purchasedCoins, setPurchasedCoins] = useState(0)
  const [transactionId, setTransactionId] = useState('')

  const [exchangeRate, setExchangeRate] = useState<number>(58.25)
  const [loadingRate, setLoadingRate] = useState<boolean>(true)

  // Withdrawal States
  const [withdrawAmount, setWithdrawAmount] = useState<number>(10)
  const [withdrawEmail, setWithdrawEmail] = useState<string>('')
  const [withdrawPending, setWithdrawPending] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState<boolean>(false)

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setWithdrawPending(true)
    setWithdrawError(null)
    setWithdrawSuccess(false)

    try {
      const res = await requestWithdrawalAction(withdrawAmount, withdrawEmail)
      if (res.error) {
        setWithdrawError(res.error)
      } else {
        setWithdrawSuccess(true)
        alert('¡Retiro procesado y enviado con éxito a tu cuenta de PayPal!')
        window.location.reload()
      }
    } catch (err: any) {
      console.error(err)
      setWithdrawError('Ocurrió un error inesperado al procesar el retiro.')
    } finally {
      setWithdrawPending(false)
    }
  }

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        const rate = data.rates?.DOP
        if (typeof rate === 'number' && rate > 0) {
          setExchangeRate(rate)
        }
        setLoadingRate(false)
      })
      .catch(err => {
        console.error('Error fetching rate on client:', err)
        setLoadingRate(false)
      })
  }, [])

  useEffect(() => {
    if (!showPayment || !sdkLoaded || !(window as any).paypal) return

    const container = document.getElementById('paypal-button-container')
    if (container) container.innerHTML = ''

    ;(window as any).paypal.Buttons({
      style: {
        layout: 'horizontal',
        color: 'gold',
        shape: 'pill',
        label: 'pay',
        height: 45,
        tagline: false
      },
      createOrder: async () => {
        try {
          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
          })
          const data = await res.json()
          if (data.error) {
            alert(data.error)
            throw new Error(data.error)
          }
          return data.id
        } catch (err: any) {
          console.error(err)
          alert('Error al iniciar orden en PayPal')
          throw err
        }
      },
      onApprove: async (data: any) => {
        setIsProcessing(true)
        try {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID })
          })
          const capture = await res.json()
          if (capture.error) {
            alert(`Error al capturar el pago: ${capture.error}`)
          } else if (capture.success) {
            setPurchasedCoins(capture.coinsAdded)
            setTransactionId(capture.depositId || '')
            setShowThankYouModal(true)
          } else {
            alert('¡Recarga acreditada con éxito!')
            window.location.reload()
          }
        } catch (err: any) {
          console.error(err)
          alert('Error al acreditar recarga')
        } finally {
          setIsProcessing(false)
        }
      },
      onError: (err: any) => {
        console.error('PayPal button error:', err)
        alert('Hubo un error con la pasarela de PayPal')
      }
    }).render('#paypal-button-container')
  }, [showPayment, sdkLoaded, amount])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Script for PayPal SDK */}
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD&enable-funding=card&disable-funding=paylater,venmo`}
        onLoad={() => setSdkLoaded(true)}
        onError={() => console.error('Failed to load PayPal SDK')}
      />

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-dark-card to-[#121217] border border-white/5 space-y-4 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/30">Mi Balance</span>
            <span className="text-xl">🪙</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-orbitron font-black text-white">{initialBalance.toFixed(2)}</h2>
            <p className="text-xs text-neon-cyan uppercase font-bold tracking-widest font-orbitron">K-Coins Disponibles</p>
          </div>
        </div>

        {/* Deposit Form Card */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-dark-card border border-white/5 space-y-6 text-left">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <ArrowUpRight size={16} className="text-neon-cyan" /> Recargar Saldo (K-Coins)
          </h3>

          {!showPayment ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Monto a Depositar (USD)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                      className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan"
                    />
                  </div>
                  <button
                    onClick={() => setShowPayment(true)}
                    className="px-6 py-2.5 bg-neon-cyan hover:bg-neon-cyan/85 text-black font-bold font-orbitron rounded-xl text-xs uppercase tracking-widest transition-all"
                  >
                    Confirmar
                  </button>
                </div>
                <p className="text-[10px] text-white/30 italic mt-1.5">
                  * El depósito en USD se acreditará en K-Coins según la tasa del día: 1 USD = {exchangeRate.toFixed(2)} K-Coins (tasa de cambio oficial en tiempo real).
                </p>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2">
                {[10, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold font-orbitron transition-all border ${
                      amount === val
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-white/5 text-white/40 border-transparent hover:text-white/60'
                    }`}
                  >
                    ${val} USD
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-white/8 bg-gradient-to-b from-[#0f1117] to-[#0a0c10] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              {/* PayPal header stripe */}
              <div className="bg-gradient-to-r from-[#003087] via-[#009cde] to-[#012169] h-1" />

              <div className="p-5 space-y-4">
                {/* Title + secure badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#009cde]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.067 8.478c.492.315.844.825.966 1.41.372 1.86-.878 3.667-2.783 4.09-.208.045-.42.066-.634.066H16.3l-.515 2.65a.5.5 0 0 1-.49.406h-1.73a.5.5 0 0 1-.49-.594l1.7-8.714h3.37c.702 0 1.365.24 1.922.686ZM5.555 6.374l-.994 5.11-.61 3.124H3.8a.5.5 0 0 0-.49.594l.247 1.27H1.61a.5.5 0 0 1-.49-.406L-.016 9.59a.5.5 0 0 1 .49-.594H2.89l.617-3.17a.5.5 0 0 1 .49-.406h1.558c.23 0 .43.158.49.406Z"/>
                    </svg>
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest font-orbitron">Pago Seguro</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-green-400/80 font-semibold">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    SSL Seguro
                  </div>
                </div>

                {/* Amount breakdown */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40">Monto a Recargar:</span>
                    <span className="font-bold text-white">${amount.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-white/[0.04] pt-2">
                    <span className="text-white/40">K-Coins a recibir (×{exchangeRate.toFixed(2)}):</span>
                    <span className="font-orbitron font-black text-yellow-400">🪙 {(amount * exchangeRate).toFixed(2)}</span>
                  </div>
                </div>

                {/* Change amount link */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowPayment(false)}
                    className="text-[10px] font-bold text-white/30 hover:text-neon-cyan transition-colors uppercase tracking-widest"
                  >
                    ← Cambiar monto
                  </button>
                </div>

                {/* Buttons area */}
                {isProcessing ? (
                  <div className="p-5 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#009cde] mx-auto" />
                    <p className="text-[10px] text-white/50">Acreditando tu K-Coins, por favor espera...</p>
                  </div>
                ) : !process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
                    ⚠️ Falta NEXT_PUBLIC_PAYPAL_CLIENT_ID en Vercel.
                  </div>
                ) : (
                  <div className="w-full">
                    <div id="paypal-button-container" className="w-full rounded-xl overflow-hidden"></div>
                    <p className="text-center text-[9px] text-white/25 mt-2 flex items-center justify-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                      Procesado de forma segura por PayPal
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Withdraw Form Card */}
        <div className="md:col-span-3 p-6 rounded-2xl bg-dark-card border border-white/5 space-y-6 text-left">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <ArrowDownLeft size={16} className="text-red-400" /> Retirar Fondos a PayPal (Auto-Payout)
          </h3>

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Monto a Retirar (K-Coins)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xs">🪙</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                    className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan"
                    required
                  />
                </div>
                <p className="text-[9px] text-white/30 italic">
                  * 1 K-Coin = 1 DOP. El monto se convertirá a dólares según la tasa del día.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Correo Electrónico de PayPal</label>
                <input
                  type="email"
                  placeholder="ejemplo@paypal.com"
                  value={withdrawEmail}
                  onChange={(e) => setWithdrawEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan"
                  required
                />
                <p className="text-[9px] text-white/30 italic">
                  * Asegúrate de ingresar el correo correcto asociado a tu cuenta de PayPal.
                </p>
              </div>
            </div>

            {/* Live Conversion Summary */}
            <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
              <div>
                <span className="text-[10px] text-white/40 uppercase block">Resumen del Retiro (Tasa: 1 USD = {exchangeRate.toFixed(2)} DOP)</span>
                <span className="text-sm font-bold text-white">
                  🪙 {withdrawAmount.toFixed(2)} K-Coins &rarr; $ {(withdrawAmount / exchangeRate).toFixed(2)} USD
                </span>
              </div>
              <button
                type="submit"
                disabled={withdrawPending || withdrawAmount <= 0 || !withdrawEmail.trim() || initialBalance < withdrawAmount}
                className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold font-orbitron rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-40"
              >
                {withdrawPending ? (
                  <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Procesando...</span>
                ) : (
                  'Solicitar Envío'
                )}
              </button>
            </div>

            {/* Error message */}
            {withdrawError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
                ⚠️ {withdrawError}
              </div>
            )}

            {/* Balance check warning */}
            {initialBalance < withdrawAmount && (
              <p className="text-[10px] text-red-400/90 font-bold leading-normal">
                ❌ Saldo insuficiente en tu billetera para retirar este monto.
              </p>
            )}
          </form>
        </div>
      </div>

      {/* History Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recargas History */}
        <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-4 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
            <Landmark size={14} className="text-white/30" /> Historial de Depósitos
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {deposits.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/20 italic">No hay depósitos registrados.</div>
            ) : (
              deposits.map((dep) => (
                <div key={dep.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-white/70">${parseFloat(dep.amount).toFixed(2)} USD</span>
                    <span className="block text-[9px] text-white/30 mt-0.5">{new Date(dep.created_at).toLocaleString('es')}</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                    dep.status === 'completed'
                      ? 'border-green-500/20 text-green-400 bg-green-500/5'
                      : dep.status === 'pending'
                      ? 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5'
                      : 'border-red-500/20 text-red-400 bg-red-500/5'
                  }`}>
                    {dep.status === 'completed' ? 'Completado' : dep.status === 'pending' ? 'Pendiente' : 'Fallido'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transactions History */}
        <div className="p-6 rounded-2xl bg-dark-card border border-white/5 space-y-4 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
            <History size={14} className="text-white/30" /> Movimientos de Cuenta
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/20 italic">No hay transacciones registradas.</div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                      {tx.type === 'deposit' ? 'Depósito'
                        : tx.type === 'withdrawal' ? 'Retiro PayPal'
                        : tx.type === 'raffle_ticket' ? 'Compra de Rifa'
                        : tx.type === 'bet_placed' ? 'Apuesta Realizada'
                        : tx.type === 'bet_won' ? 'Apuesta Ganada'
                        : 'Apuesta Reembolsada'}
                    </span>
                    <span className="block text-[9px] text-white/30 mt-0.5">{new Date(tx.created_at).toLocaleString('es')}</span>
                  </div>
                  <span className={`text-xs font-orbitron font-bold ${parseFloat(tx.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Thank You Modal */}
      <AnimatePresence>
        {showThankYouModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-[#0d0d0f] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,180,216,0.15)] text-center relative"
            >
              <div className="h-1.5 bg-gradient-to-r from-green-500 via-neon-cyan to-neon-purple" />
              
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowThankYouModal(false)
                  window.location.reload()
                }}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
              >
                <X size={16} />
              </button>

              <div className="p-8 space-y-6">
                {/* Success Icon */}
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400">
                  <CheckCircle size={36} className="animate-bounce" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-orbitron font-black text-white uppercase tracking-tight">¡Gracias por tu compra!</h3>
                  <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
                    Tu pago ha sido procesado de forma automática y los K-Coins han sido acreditados a tu cuenta.
                  </p>
                </div>

                {/* Details Card */}
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-left space-y-3">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-white/30 block mb-1">Detalles de la Transacción</span>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/45">Monto Acreditado:</span>
                    <span className="font-orbitron font-bold text-yellow-400">🪙 {purchasedCoins.toFixed(2)} K-Coins</span>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-white/[0.03] pt-2">
                    <span className="text-white/45">Método de Pago:</span>
                    <span className="text-white/80 font-medium">PayPal / Tarjeta de Crédito</span>
                  </div>

                  {transactionId && (
                    <div className="flex justify-between items-center text-xs border-t border-white/[0.03] pt-2">
                      <span className="text-white/45">ID de Depósito:</span>
                      <code className="text-[10px] font-mono text-neon-cyan select-all">{transactionId.slice(0, 18)}...</code>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <button
                  onClick={() => {
                    setShowThankYouModal(false)
                    window.location.reload()
                  }}
                  className="w-full py-3 bg-neon-cyan text-black hover:bg-neon-cyan/90 transition-all rounded-2xl text-xs font-black uppercase tracking-widest font-orbitron shadow-[0_0_15px_rgba(0,180,216,0.2)] active:scale-[0.98]"
                >
                  Volver al Comercio
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
