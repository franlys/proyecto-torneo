import { Metadata } from 'next'
import { RefundRequestClient } from './RefundRequestClient'

export const metadata: Metadata = {
  title: 'Solicitar Reembolso | Kronix',
  description: 'Solicita el reembolso de tus boletos de sorteo (PayPal / K-Coins) de manera automática.',
}

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-12 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-neon-cyan/5 blur-[120px] rounded-full opacity-50 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10 max-w-2xl">
        <div className="text-center mb-10 space-y-4">
          <h1 className="text-4xl md:text-5xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-neon-cyan to-white uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(0,245,255,0.3)]">
            Centro de Reembolsos
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto">
            Si tuviste un problema con tu compra de boletos o el sorteo ha sido cancelado, puedes solicitar tu reembolso aquí. Si compraste como invitado (sin cuenta) mediante PayPal, puedes buscar tu compra usando el ID de Transacción.
          </p>
        </div>

        <RefundRequestClient />
      </div>
    </div>
  )
}
