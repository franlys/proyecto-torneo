'use client'

import React, { useState, useEffect } from 'react'
import Script from 'next/script'
import { Landmark, ArrowUpRight, ArrowDownLeft, History, Loader2, CheckCircle, X, Coins, Trophy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { requestWithdrawalAction } from '@/lib/actions/withdrawals'
import { calculatePayPalGrossAmount } from '@/lib/services/paypal-fee'
import { GlowCard } from '@/components/ui/GlowCard'

interface WalletClientProps {
  initialBalance: number
  transactions: any[]
  deposits: any[]
  prefilledAmount?: number
  redirectUrl?: string
}

export function WalletClient({ initialBalance, transactions, deposits, prefilledAmount, redirectUrl }: WalletClientProps) {
  const [amount, setAmount] = useState<number | ''>(prefilledAmount || 10)
  const [showPayment, setShowPayment] = useState(false)
  const [sdkLoaded, setSdkLoaded] = useState(typeof window !== 'undefined' && !!(window as any).paypal)
  const [isProcessing, setIsProcessing] = useState(false)
  const [paypalRendered, setPaypalRendered] = useState(false)
  const [showPaypalModal, setShowPaypalModal] = useState(false)
  
  // Custom CardFields states
  const [cardFieldsInstance, setCardFieldsInstance] = useState<any>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [cardType, setCardType] = useState<string>('visa')
  const [isFlipped, setIsFlipped] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [cardholderName, setCardholderName] = useState('')
  const [cardSubmitPending, setCardSubmitPending] = useState(false)
  const [cardFieldsEligible, setCardFieldsEligible] = useState(true)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  // Thank You modal states
  const [showThankYouModal, setShowThankYouModal] = useState(false)
  const [purchasedCoins, setPurchasedCoins] = useState<number | undefined>(undefined)

  // Auto-trigger deposit payment if amount is prefilled
  useEffect(() => {
    if (prefilledAmount && prefilledAmount > 0) {
      setShowPayment(true)
      setShowPaypalModal(true)
    }
  }, [prefilledAmount])

  useEffect(() => {
    if (showPaypalModal || showThankYouModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showPaypalModal, showThankYouModal])
  const [transactionId, setTransactionId] = useState('')

  const [exchangeRate, setExchangeRate] = useState<number>(58.25)
  const [loadingRate, setLoadingRate] = useState<boolean>(true)

  // Withdrawal States
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>(10)
  const [withdrawEmail, setWithdrawEmail] = useState<string>('')
  const [withdrawPending, setWithdrawPending] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState<boolean>(false)

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawAmount || withdrawAmount <= 0) {
      setWithdrawError('Por favor, ingresa un monto válido a retirar.')
      return
    }
    setWithdrawPending(true)
    setWithdrawError(null)
    setWithdrawSuccess(false)

    try {
      const res = await requestWithdrawalAction(withdrawAmount as number, withdrawEmail)
      if (res.error) {
        setWithdrawError(res.error)
      } else {
        setWithdrawSuccess(true)
        alert('¡Solicitud de retiro recibida con éxito! Tu retiro ha sido registrado y está en proceso de envío a tu correo de PayPal.')
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
    setPaypalRendered(false)

    // Render standard PayPal checkout button (excluding default Card button)
    ;(window as any).paypal.Buttons({
      fundingSource: (window as any).paypal.FUNDING.PAYPAL,
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay',
        height: 48,
        tagline: false,
        borderRadius: 12
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
            setPurchasedCoins(capture.coinsAdded || capture.dopAmount || 0)
            setTransactionId(capture.depositId || '')
            setShowPaypalModal(false)
            setShowThankYouModal(true)
          } else {
            alert('¡Recarga acreditada con éxito!')
            if (redirectUrl) {
              window.location.href = redirectUrl
            } else {
              window.location.reload()
            }
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
    }).render('#paypal-button-container').then(() => {
      setPaypalRendered(true)
    })

    // Render Custom CardFields if eligible
    if ((window as any).paypal.CardFields) {
      const cardFields = (window as any).paypal.CardFields({
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
              setCardError(`Error al capturar el pago: ${capture.error}`)
            } else if (capture.success) {
              setPurchasedCoins(capture.coinsAdded || capture.dopAmount || 0)
              setTransactionId(capture.depositId || '')
              setShowPaypalModal(false)
              setShowThankYouModal(true)
            } else {
              alert('¡Recarga acreditada con éxito!')
              window.location.reload()
            }
          } catch (err: any) {
            console.error(err)
            setCardError('Error al acreditar recarga')
          } finally {
            setIsProcessing(false)
            setCardSubmitPending(false)
          }
        },
        onError: (err: any) => {
          console.error('PayPal CardFields error:', err)
          setCardError('Error en la validación de la tarjeta. Verifica los datos e intenta de nuevo.')
          setCardSubmitPending(false)
        },
        inputEvents: {
          onChange: (data: any) => {
            if (data.cardType) {
              setCardType(data.cardType)
            }
          },
          onFocus: (data: any) => {
            setFocusedField(data.emittedBy)
            if (data.emittedBy === 'cvv') {
              setIsFlipped(true)
            } else {
              setIsFlipped(false)
            }
          },
          onBlur: (data: any) => {
            setFocusedField(null)
            if (data.emittedBy === 'cvv') {
              setIsFlipped(false)
            }
          }
        }
      })

      if (cardFields.isEligible()) {
        setCardFieldsEligible(true)
        // Clear containers before rendering
        const numContainer = document.getElementById('card-number-container')
        const expContainer = document.getElementById('card-expiry-container')
        const cvvContainer = document.getElementById('card-cvv-container')
        const postalContainer = document.getElementById('card-postal-code-container')
        
        if (numContainer) numContainer.innerHTML = ''
        if (expContainer) expContainer.innerHTML = ''
        if (cvvContainer) cvvContainer.innerHTML = ''
        if (postalContainer) postalContainer.innerHTML = ''

        cardFields.NumberField().render('#card-number-container')
        cardFields.ExpiryField().render('#card-expiry-container')
        cardFields.CVVField().render('#card-cvv-container')
        cardFields.PostalCodeField().render('#card-postal-code-container')

        setCardFieldsInstance(cardFields)
      } else {
        setCardFieldsEligible(false)
        console.warn('PayPal Card Fields not eligible')
      }
    }
  }, [showPayment, sdkLoaded, amount])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Script for PayPal SDK */}
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=USD&components=buttons,card-fields&enable-funding=paylater,venmo`}
        onLoad={() => setSdkLoaded(true)}
        onError={() => console.error('Failed to load PayPal SDK')}
      />

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <GlowCard glowColor="#00F5FF" borderColor="rgba(0, 245, 255, 0.15)" className="p-6 bg-gradient-to-br from-[#0d0f15] to-[#161922] flex flex-col justify-between min-h-[160px] text-left self-start w-full">
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-neon-cyan/5 rounded-full blur-2xl group-hover:bg-neon-cyan/15 transition-colors" />
          <div className="absolute -left-10 -top-10 w-24 h-24 bg-neon-purple/5 rounded-full blur-xl" />

          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Billetera de Kronix</span>
            <div className="w-8 h-8 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center">
              <Coins className="w-4 h-4 text-neon-cyan animate-pulse" />
            </div>
          </div>

          <div className="space-y-1 relative z-10 mt-6">
            <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold">K-Coins Disponibles</span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-orbitron font-black text-white tracking-tight">
                {(initialBalance || 0).toFixed(2)}
              </h2>
              <span className="text-neon-cyan font-bold text-[10px] uppercase font-orbitron">KC</span>
            </div>
          </div>

          <div className="text-[9px] text-white/30 mt-4 border-t border-white/5 pt-3 relative z-10 flex justify-between">
            <span>Equivalente:</span>
            <span className="font-bold text-white/60">
              ${((initialBalance || 0) / exchangeRate).toFixed(2)} USD
            </span>
          </div>
        </GlowCard>

        {/* Deposit Form Card */}
        <GlowCard glowColor="#00F5FF" borderColor="rgba(255, 255, 255, 0.05)" className="md:col-span-2 p-6 bg-dark-card space-y-6 text-left">
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
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') {
                          setAmount('')
                        } else {
                          const parsed = parseFloat(val)
                          setAmount(isNaN(parsed) ? '' : Math.max(0, parsed))
                        }
                      }}
                      className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan"
                    />
                  </div>
                  <button
                    onClick={() => setShowPayment(true)}
                    disabled={!amount || amount <= 0}
                    className="px-6 py-2.5 bg-neon-cyan hover:bg-neon-cyan/85 text-black font-bold font-orbitron rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
              <div className="bg-gradient-to-r from-[#003087] via-[#009cde] to-[#012169] h-1" />
              <div className="p-5 space-y-4">
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

                {(() => {
                  const netVal = amount || 0
                  const { grossAmount, fee } = calculatePayPalGrossAmount(netVal)
                  return (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40">Monto de Recarga:</span>
                        <span className="font-bold text-white">${netVal.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/40">Tarifa Pasarela (PayPal):</span>
                        <span className="text-white/60">+${fee.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-white/[0.04] pt-2">
                        <span className="text-white/70 font-semibold">Total a Cobrar:</span>
                        <span className="font-orbitron font-black text-neon-cyan">${grossAmount.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-white/[0.04] pt-2">
                        <span className="text-white/40">K-Coins a recibir (×{exchangeRate.toFixed(2)}):</span>
                        <span className="font-orbitron font-black text-yellow-400 flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                          {(netVal * exchangeRate).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )
                })()}

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowPayment(false)}
                    className="text-[10px] font-bold text-white/30 hover:text-neon-cyan transition-colors uppercase tracking-widest"
                  >
                    ← Cambiar monto
                  </button>
                </div>

                {isProcessing ? (
                  <div className="p-4 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#009cde] mx-auto" />
                    <p className="text-[10px] text-white/50">Acreditando tus K-Coins, por favor espera...</p>
                  </div>
                ) : !process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
                    ⚠️ Falta NEXT_PUBLIC_PAYPAL_CLIENT_ID en Vercel.
                  </div>
                ) : (
                  <div className="p-4 bg-transparent space-y-6">
                    {/* CSS for 3D Card and custom styles */}
                    <style dangerouslySetInnerHTML={{__html: `
                      .card-perspective {
                        perspective: 1000px;
                      }
                      .card-container {
                        width: 100%;
                        max-width: 380px;
                        height: 228px;
                        position: relative;
                        transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        transform-style: preserve-3d;
                        margin: 0 auto;
                        cursor: pointer;
                      }
                      .card-face {
                        position: absolute;
                        inset: 0;
                        backface-visibility: hidden;
                        border-radius: 16px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        padding: 20px;
                        transform-style: preserve-3d;
                        user-select: auto;
                      }
                      .card-front {
                        background: linear-gradient(135deg, #0d0f14 0%, #171a24 100%);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        box-shadow: 0 15px 35px rgba(0,0,0,0.5), 0 0 15px rgba(0, 245, 255, 0.05);
                        transform: translateZ(1px);
                      }
                      .card-back {
                        background: linear-gradient(135deg, #090a0d 0%, #12131a 100%);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        transform: rotateY(180deg) translateZ(1px);
                        box-shadow: 0 15px 35px rgba(0,0,0,0.5);
                      }
                      .card-glow-active {
                        box-shadow: 0 0 20px 4px rgba(0, 245, 255, 0.35), 0 0 60px 10px rgba(0, 245, 255, 0.15) !important;
                        border-color: rgba(0, 245, 255, 0.4) !important;
                      }
                      .paypal-card-label {
                        font-size: 8px;
                        color: rgba(255, 255, 255, 0.3);
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                        font-weight: bold;
                        margin-bottom: 3px;
                      }
                      .paypal-field-container {
                        position: relative;
                        z-index: 10;
                        height: 38px;
                        background: rgba(255, 255, 255, 0.03);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 8px;
                        padding: 0 8px;
                        display: flex;
                        align-items: center;
                        transition: all 0.2s ease;
                        pointer-events: auto;
                      }
                      .paypal-field-container.focused {
                        border-color: #00F5FF;
                        background: rgba(255, 255, 255, 0.06);
                        box-shadow: 0 0 10px rgba(0, 245, 255, 0.15);
                      }
                      #paypal-button-container {
                        background: transparent !important;
                      }
                      #paypal-button-container .paypal-buttons {
                        border-radius: 12px;
                        overflow: hidden;
                      }
                    `}} />

                    {/* Standard PayPal Yellow Button */}
                    <div className="space-y-3 text-center">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Pagar con Cuenta PayPal</span>
                      </div>
                      {!paypalRendered && (
                        <div className="h-[48px] rounded-xl bg-[#FFC439]/10 animate-pulse" />
                      )}
                      <div
                        id="paypal-button-container"
                        className={`w-full transition-opacity duration-300 ${paypalRendered ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
                      />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center my-6">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="px-3 text-[10px] text-white/30 uppercase tracking-widest font-orbitron">O usar Tarjeta de Débito / Crédito</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* 3D Card Interactive Preview */}
                    <div className="card-perspective py-2 flex flex-col items-center">
                      <div
                        className={`card-container ${focusedField ? 'card-glow-active' : ''}`}
                        style={{
                          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y + (isFlipped ? 180 : 0)}deg)`
                        }}
                        onMouseMove={(e) => {
                          const card = e.currentTarget
                          const box = card.getBoundingClientRect()
                          const x = e.clientX - box.left - box.width / 2
                          const y = e.clientY - box.top - box.height / 2
                          const tiltX = (y / (box.height / 2)) * -12
                          const tiltY = (x / (box.width / 2)) * 12
                          setTilt({ x: tiltX, y: tiltY })
                        }}
                        onMouseLeave={() => {
                          setTilt({ x: 0, y: 0 })
                        }}
                        onClick={() => {
                          setIsFlipped(!isFlipped)
                        }}
                      >
                        {/* Front Face */}
                        <div
                          className="card-face card-front"
                          style={{
                            pointerEvents: 'none',
                            zIndex: isFlipped ? 1 : 2
                          }}
                        >
                          {/* Dynamic sheen overlay inside face */}
                          <div
                            className="absolute inset-0 opacity-15 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl z-0"
                            style={{
                              transform: `translate(${tilt.y * 1.5}px, ${tilt.x * 1.5}px)`
                            }}
                          />

                          {/* Top: Chip and Card Brand Logo */}
                          <div className="flex justify-between items-start z-10">
                            {/* Golden Chip */}
                            <div className="w-9 h-7 rounded bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border border-amber-600/30 relative overflow-hidden flex flex-col justify-around p-1">
                              <div className="h-[1px] bg-black/10 w-full" />
                              <div className="h-[1px] bg-black/10 w-full" />
                              <div className="h-[1px] bg-black/10 w-full" />
                              <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-black/10" />
                            </div>
                            
                            {/* Card Brand Logo */}
                            <div className="text-right">
                              {cardType === 'visa' ? (
                                <span className="text-white font-orbitron font-black italic text-lg tracking-wider text-neon-cyan shadow-sm">VISA</span>
                              ) : cardType === 'mastercard' ? (
                                <span className="text-white font-orbitron font-black italic text-lg tracking-wider text-orange-400 shadow-sm">MasterCard</span>
                              ) : cardType === 'amex' ? (
                                <span className="text-white font-orbitron font-black italic text-lg tracking-wider text-green-400 shadow-sm">AMEX</span>
                              ) : (
                                <span className="text-white font-orbitron font-bold italic text-sm tracking-wider text-white/50">CARD</span>
                              )}
                            </div>
                          </div>

                          {/* Middle: Card Number container */}
                          <div className="space-y-1 text-left z-10">
                            <span className="paypal-card-label">Número de Tarjeta</span>
                            <div className={`h-9 px-3 bg-white/5 border rounded-lg flex items-center justify-start transition-all duration-200 ${focusedField === 'number' ? 'border-neon-cyan bg-neon-cyan/5 shadow-[0_0_8px_rgba(0,245,255,0.15)]' : 'border-white/5'}`}>
                              <p className="font-mono text-sm tracking-widest text-white/90">
                                •••• &nbsp; •••• &nbsp; •••• &nbsp; ••••
                              </p>
                            </div>
                          </div>

                          {/* Bottom: Expiry, Postal Code, Cardholder Name */}
                          <div className="grid grid-cols-3 gap-3 items-end text-left z-10">
                            <div className="col-span-2 space-y-1">
                              <span className="paypal-card-label">Titular</span>
                              <div className={`h-9 px-2 bg-white/5 border rounded-lg flex items-center justify-start overflow-hidden transition-all duration-200 ${focusedField === 'name' ? 'border-neon-cyan bg-neon-cyan/5 shadow-[0_0_8px_rgba(0,245,255,0.15)]' : 'border-white/5'}`}>
                                <p className="font-mono text-[10px] tracking-widest text-white truncate uppercase">
                                  {cardholderName || 'NOMBRE TITULAR'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <span className="paypal-card-label">Vence</span>
                              <div className={`h-9 px-2 bg-white/5 border rounded-lg flex items-center justify-center transition-all duration-200 ${focusedField === 'expiry' ? 'border-neon-cyan bg-neon-cyan/5 shadow-[0_0_8px_rgba(0,245,255,0.15)]' : 'border-white/5'}`}>
                                <p className="font-mono text-xs text-white/95">
                                  MM/AA
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back Face */}
                        <div
                          className="card-face card-back justify-between py-5 text-left"
                          style={{
                            pointerEvents: 'none',
                            zIndex: isFlipped ? 2 : 1
                          }}
                        >
                          {/* Dynamic sheen overlay inside face */}
                          <div
                            className="absolute inset-0 opacity-10 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl z-0"
                            style={{
                              transform: `translate(${tilt.y * 1.5}px, ${tilt.x * 1.5}px)`
                            }}
                          />

                          {/* Magnetic stripe */}
                          <div className="h-9 bg-black/80 -mx-5 mt-1 z-10" />

                          {/* CVV Container */}
                          <div className="space-y-1 px-2 z-10">
                            <div className="flex justify-between items-center">
                              <span className="paypal-card-label">Código de Seguridad (CVC)</span>
                              {/* Small generic brand label on back */}
                              <span className="text-[8px] font-orbitron font-bold text-white/20">KRONIX PLATINUM</span>
                            </div>
                            <div className="flex gap-2 items-center">
                              {/* Mock signature panel */}
                              <div className="flex-1 h-8 bg-white/10 rounded border border-white/5 flex items-center px-2">
                                <span className="font-serif italic text-xs text-white/30 tracking-wider">Kronix Club</span>
                              </div>
                              <div className={`w-16 h-8 bg-white/5 border rounded flex items-center justify-center transition-all duration-200 ${focusedField === 'cvv' ? 'border-neon-cyan bg-neon-cyan/5 shadow-[0_0_8px_rgba(0,245,255,0.15)]' : 'border-white/5'}`}>
                                <span className="font-mono text-sm text-white tracking-widest">•••</span>
                              </div>
                            </div>
                          </div>

                          {/* Small disclaimer text */}
                          <div className="px-2 z-10">
                            <p className="text-[6px] text-white/20 leading-tight">
                              Esta tarjeta digital interactiva representa una conexión segura encriptada punto a punto con PayPal. Ningún dato de pago sensible es almacenado por Kronix.
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-[9px] text-white/30 text-center mt-2">💡 Haz clic en la tarjeta para voltearla y ver el reverso</p>
                    </div>

                    {/* Standard Input Fields Below Card (Cardholder Name & Postal Code) */}
                    <div className="space-y-4 text-left max-w-sm mx-auto">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Número de Tarjeta</label>
                        <div
                          id="card-number-container"
                          className={`paypal-field-container ${focusedField === 'number' ? 'focused' : ''}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Fecha de Vencimiento (MM/AA)</label>
                          <div
                            id="card-expiry-container"
                            className={`paypal-field-container ${focusedField === 'expiry' ? 'focused' : ''}`}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Código de Seguridad (CVV)</label>
                          <div
                            id="card-cvv-container"
                            className={`paypal-field-container ${focusedField === 'cvv' ? 'focused' : ''}`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Nombre del Titular</label>
                          <input
                            type="text"
                            placeholder="Juan Pérez"
                            value={cardholderName}
                            onChange={(e) => setCardholderName(e.target.value)}
                            onFocus={() => {
                              setFocusedField('name')
                              setIsFlipped(false)
                            }}
                            onBlur={() => setFocusedField(null)}
                            className="w-full px-3 h-[38px] bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-neon-cyan transition-colors"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Código Postal (ZIP)</label>
                          <div
                            id="card-postal-code-container"
                            className={`paypal-field-container ${focusedField === 'postalCode' ? 'focused' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Pay Button */}
                      <button
                        onClick={async (e) => {
                          e.preventDefault()
                          if (!cardFieldsInstance) return
                          if (!cardholderName.trim()) {
                            setCardError('Por favor, ingresa el nombre del titular de la tarjeta.')
                            return
                          }
                          setCardSubmitPending(true)
                          setCardError(null)
                          try {
                            await cardFieldsInstance.submit({
                              cardholderName: cardholderName
                            })
                          } catch (err: any) {
                            console.error(err)
                            setCardError('No se pudo procesar el pago. Por favor verifica tus datos e intenta de nuevo.')
                            setCardSubmitPending(false)
                          }
                        }}
                        disabled={cardSubmitPending || isProcessing}
                        className="w-full py-3 bg-neon-cyan hover:bg-neon-cyan/85 text-black font-bold font-orbitron rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:shadow-[0_0_25px_rgba(0,245,255,0.4)]"
                      >
                        {cardSubmitPending || isProcessing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Procesando Pago Seguro...
                          </>
                        ) : (
                          <>
                            <span>🔒 Pagar ahora</span>
                            <span>${(amount || 0).toFixed(2)} USD</span>
                          </>
                        )}
                      </button>

                      {/* Error messaging */}
                      {cardError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold rounded-xl text-center">
                          ⚠️ {cardError}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </GlowCard>

        {/* Withdraw Form Card */}
        <GlowCard glowColor="#b026ff" borderColor="rgba(255, 255, 255, 0.05)" className="md:col-span-3 p-6 bg-dark-card space-y-6 text-left">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <ArrowDownLeft size={16} className="text-red-400" /> Retirar Fondos a PayPal (Auto-Payout)
          </h3>

          <form onSubmit={handleWithdraw} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold block">Monto a Retirar (K-Coins)</label>
                <div className="relative">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-3.5 h-3.5 shrink-0" />
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '') {
                        setWithdrawAmount('')
                      } else {
                        const parsed = parseFloat(val)
                        setWithdrawAmount(isNaN(parsed) ? '' : Math.max(0, parsed))
                      }
                    }}
                    placeholder="0"
                    min="0"
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
                <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-1">
                  <Coins className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  <span>{(withdrawAmount || 0).toFixed(2)} K-Coins</span>
                  <span className="text-white/30 font-normal">&rarr;</span>
                  <span className="text-neon-cyan">${((withdrawAmount || 0) / exchangeRate).toFixed(2)} USD</span>
                </span>
              </div>
              <button
                type="submit"
                disabled={withdrawPending || !withdrawAmount || withdrawAmount <= 0 || !withdrawEmail.trim() || initialBalance < (withdrawAmount || 0)}
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
            {withdrawAmount !== '' && initialBalance < (withdrawAmount || 0) && (
              <p className="text-[10px] text-red-400/90 font-bold leading-normal">
                ❌ Saldo insuficiente en tu billetera para retirar este monto.
              </p>
            )}
          </form>
        </GlowCard>
      </div>

      {/* History Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recargas History */}
        <GlowCard glowColor="#00F5FF" borderColor="rgba(255, 255, 255, 0.05)" className="p-6 bg-dark-card space-y-4 text-left">
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
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                      dep.status === 'completed'
                        ? 'border-green-500/20 text-green-400 bg-green-500/5'
                        : dep.status === 'pending'
                        ? 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5'
                        : dep.status === 'refunded'
                        ? 'border-purple-500/20 text-purple-400 bg-purple-500/5'
                        : 'border-red-500/20 text-red-400 bg-red-500/5'
                    }`}>
                      {dep.status === 'completed' ? 'Completado' : dep.status === 'pending' ? 'Pendiente' : dep.status === 'refunded' ? 'Reembolsado' : 'Fallido'}
                    </span>
                    {dep.status === 'completed' && (
                      <button
                        onClick={async () => {
                          const reason = prompt('Motivo del reembolso:');
                          if (!reason) return;
                          const { requestWalletRefundAction } = await import('@/lib/actions/wallet');
                          const res = await requestWalletRefundAction(dep.id, reason);
                          if (res?.error) alert(res.error);
                          else {
                            alert(res?.message);
                            window.location.reload();
                          }
                        }}
                        className="text-[9px] text-white/40 hover:text-white underline"
                      >
                        Reembolsar
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlowCard>

        {/* Transactions History */}
        <GlowCard glowColor="#b026ff" borderColor="rgba(255, 255, 255, 0.05)" className="p-6 bg-dark-card space-y-4 text-left">
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
                        : tx.type === 'vip_purchase' ? 'Membresía VIP'
                        : tx.type === 'raffle_ticket' ? 'Compra de Rifa'
                        : tx.type === 'bet_placed' ? 'Apuesta Realizada'
                        : tx.type === 'bet_won' ? 'Apuesta Ganada'
                        : tx.type === 'tournament_entry' ? 'Inscripción a Torneo'
                        : tx.type === 'bet_refund' ? 'Apuesta Reembolsada'
                        : 'Movimiento'}
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
        </GlowCard>
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
                  if (redirectUrl) {
                    window.location.href = redirectUrl
                  } else {
                    window.location.reload()
                  }
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
                    <span className="font-orbitron font-bold text-yellow-400 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                      <span>{(purchasedCoins || 0).toFixed(2)} K-Coins</span>
                    </span>
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
                    if (redirectUrl) {
                      window.location.href = redirectUrl
                    } else {
                      window.location.reload()
                    }
                  }}
                  className="w-full py-3 bg-neon-cyan text-black hover:bg-neon-cyan/90 transition-all rounded-2xl text-xs font-black uppercase tracking-widest font-orbitron shadow-[0_0_15px_rgba(0,180,216,0.2)] active:scale-[0.98]"
                >
                  {redirectUrl ? 'Volver al Torneo y Continuar Inscripción 🏆' : 'Continuar en Kronix'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
