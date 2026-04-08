'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import { AlertTriangle, X } from 'lucide-react'

const orbitron = Orbitron({ subsets: ['latin'] })

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  isLoading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false,
  isLoading = false
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-dark-card border border-white/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
          >
            {/* Decoration line */}
            <div className={`h-1 w-full bg-gradient-to-r ${
              isDestructive ? 'from-red-500 to-red-800' : 'from-neon-cyan to-neon-purple'
            }`} />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className={`p-3 rounded-xl ${
                  isDestructive ? 'bg-red-500/10 text-red-400' : 'bg-neon-cyan/10 text-neon-cyan'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className={`${orbitron.className} text-lg font-bold text-white mb-2`}>
                    {title}
                  </h3>
                  <p className="text-white/40 text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1 text-white/20 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 ${
                    isDestructive 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90'
                  }`}
                >
                  {isLoading ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    confirmText
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
