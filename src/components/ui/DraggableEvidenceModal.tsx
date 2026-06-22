'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, ZoomIn, ZoomOut, X, Move } from 'lucide-react'

interface DraggableEvidenceModalProps {
  isOpen: boolean
  imageUrl: string
  onClose: () => void
  title?: string
}

export function DraggableEvidenceModal({
  isOpen,
  imageUrl,
  onClose,
  title = 'Visualizador de Evidencia'
}: DraggableEvidenceModalProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleReset = () => {
    setScale(1)
    setRotation(0)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop (Closes on click) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-pointer"
          />

          {/* Draggable Modal Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            className="relative bg-[#12121e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden pointer-events-auto z-10 select-none flex flex-col"
          >
            {/* Header / Drag Bar */}
            <div className="px-5 py-3.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between cursor-move text-white active:cursor-grabbing select-none drag-handle">
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-white/40 shrink-0" />
                <span className="font-sans font-bold text-xs uppercase tracking-widest text-white/70">
                  {title}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image viewport */}
            <div className="relative flex-1 min-h-[350px] max-h-[500px] overflow-hidden bg-black/40 flex items-center justify-center p-4">
              <motion.div
                animate={{ rotate: rotation, scale: scale }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="relative max-w-full max-h-full flex items-center justify-center"
              >
                <img
                  src={imageUrl}
                  alt="Evidencia cargada"
                  className="max-w-full max-h-[450px] object-contain rounded-lg shadow-lg pointer-events-none"
                  draggable={false}
                />
              </motion.div>
            </div>

            {/* Controls Toolbar */}
            <div className="px-5 py-3.5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-white/70 hover:text-white transition-all flex items-center justify-center"
                  title="Acercar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-white/70 hover:text-white transition-all flex items-center justify-center"
                  title="Alejar zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-white/70 hover:text-white transition-all flex items-center justify-center"
                  title="Rotar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-xs text-white/60 hover:text-white transition-all"
                  title="Restablecer vista"
                >
                  Restaurar
                </button>
              </div>

              <div className="text-[10px] uppercase font-bold tracking-widest text-white/30">
                Escala: {Math.round(scale * 100)}% • Rotación: {rotation}°
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
