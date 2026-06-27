'use client'

import React from 'react'
import { Plus, Minus, Ticket } from 'lucide-react'

interface TicketSelectorProps {
  ticketPrice: number
  currency: string
  selectedCount: number
  onChange: (count: number) => void
  maxTickets?: number
}

export function TicketSelector({
  ticketPrice,
  currency,
  selectedCount,
  onChange,
  maxTickets = 100,
}: TicketSelectorProps) {
  const increment = () => {
    if (selectedCount < maxTickets) {
      onChange(selectedCount + 1)
    }
  }

  const decrement = () => {
    if (selectedCount > 1) {
      onChange(selectedCount - 1)
    }
  }

  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      {/* Ticket Counter Selection */}
      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-4 shadow-xl">
        <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
          <Ticket size={14} className="text-neon-cyan" /> CANTIDAD DE BOLETOS
        </h4>

        <div className="flex items-center justify-center gap-4 py-2">
          <button
            type="button"
            onClick={decrement}
            disabled={selectedCount <= 1}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Minus size={16} />
          </button>
          
          <input
            type="number"
            min={1}
            max={maxTickets}
            value={selectedCount}
            onChange={(e) => {
              const val = Math.max(1, Math.min(maxTickets, Number(e.target.value) || 1))
              onChange(val)
            }}
            className="w-20 text-center font-black bg-transparent border-b border-white/10 focus:outline-none focus:border-neon-cyan text-2xl font-orbitron text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          <button
            type="button"
            onClick={increment}
            disabled={selectedCount >= maxTickets}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Quick Ticket Presets */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {[5, 10, 20, 50].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const newVal = Math.min(maxTickets, selectedCount + preset)
                onChange(newVal)
              }}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-neon-cyan hover:text-white transition-all font-orbitron"
            >
              +{preset}
            </button>
          ))}
        </div>

        <div className="text-center mt-3">
          <span className="text-[10px] uppercase font-bold tracking-widest text-white/30 block">Total a Pagar</span>
          <span className="text-3xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple block mt-1">
            {currency} {(selectedCount * ticketPrice).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  )
}
