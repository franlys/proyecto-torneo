'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCw, ZoomIn, ZoomOut, X, Move, Sidebar, Trophy, Users, Eye, AlertTriangle } from 'lucide-react'

interface EvidenceModalFile {
  url: string
  evidence_type: string // 'kills' | 'top'
}

interface DraggableEvidenceModalProps {
  isOpen: boolean
  imageUrl?: string // Fallback para imagen única (ej: comprobante de pago)
  onClose: () => void
  title?: string
  evidenceFiles?: EvidenceModalFile[]
  submissionDetails?: {
    teamName: string
    killCount: number
    rank?: number
    potTop: boolean
    playerKillsBreakdown?: Array<{ name: string; kills: number }>
    aiData?: { team_name?: string; kill_count?: number; rank?: number }
    aiStatus?: string
  }
}

export function DraggableEvidenceModal({
  isOpen,
  imageUrl,
  onClose,
  title = 'Visualizador de Evidencia',
  evidenceFiles = [],
  submissionDetails
}: DraggableEvidenceModalProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [selectedType, setSelectedType] = useState<'kills' | 'top'>('kills')
  const [showSidebar, setShowSidebar] = useState(true)

  // Resetear estados cuando abre/cambia de tipo
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setRotation(0)
    }
  }, [isOpen, selectedType])

  // Obtener URL de la imagen actual a mostrar
  const getActiveImageUrl = (): string => {
    if (evidenceFiles.length > 0) {
      const matched = evidenceFiles.find(f => f.evidence_type === selectedType)
      if (matched) return matched.url
      // Fallback a cualquiera disponible
      return evidenceFiles[0]?.url || ''
    }
    return imageUrl || ''
  };

  const currentUrl = getActiveImageUrl()

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

  // Verificar discrepancia de datos reportados vs IA
  const hasKillsDiscrepancy = submissionDetails?.aiStatus === 'completed' && 
    submissionDetails?.aiData?.kill_count !== undefined && 
    submissionDetails.aiData.kill_count !== submissionDetails.killCount;

  const hasRankDiscrepancy = submissionDetails?.aiStatus === 'completed' && 
    submissionDetails?.aiData?.rank !== undefined && 
    submissionDetails.aiData.rank !== submissionDetails.rank;

  const isDualMode = evidenceFiles.length > 1;
  const hasDetails = !!submissionDetails;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop (Cierra al hacer click) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 cursor-pointer"
          />

          {/* Ventana del Modal Arrastrable */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            className={`relative bg-[#0d0d15]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full overflow-hidden pointer-events-auto z-10 select-none flex flex-col transition-all duration-300 ${
              hasDetails && showSidebar ? 'max-w-4xl' : 'max-w-2xl'
            }`}
          >
            {/* Cabecera / Barra de arrastre */}
            <div className="px-5 py-3.5 bg-white/[0.02] border-b border-white/5 flex items-center justify-between cursor-move text-white active:cursor-grabbing select-none drag-handle">
              <div className="flex items-center gap-3">
                <Move className="w-4 h-4 text-white/40 shrink-0" />
                <span className="font-sans font-bold text-xs uppercase tracking-widest text-white/70">
                  {title}
                </span>
                
                {isDualMode && (
                  <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg p-0.5 ml-4">
                    <button
                      onClick={() => setSelectedType('kills')}
                      type="button"
                      className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                        selectedType === 'kills'
                          ? 'bg-neon-cyan text-black shadow-[0_0_10px_rgba(0,245,255,0.3)]'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      💀 Kills
                    </button>
                    <button
                      onClick={() => setSelectedType('top')}
                      type="button"
                      className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                        selectedType === 'top'
                          ? 'bg-gold text-black shadow-[0_0_10px_rgba(255,215,0,0.3)]'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      🏆 Top / Posición
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {hasDetails && (
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    type="button"
                    className={`p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors flex items-center gap-1 ${
                      showSidebar ? 'text-neon-cyan bg-neon-cyan/10' : ''
                    }`}
                    title={showSidebar ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
                  >
                    <Sidebar className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={onClose}
                  type="button"
                  className="p-1 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contenido Principal (Dos columnas si se muestran detalles) */}
            <div className="flex flex-col md:flex-row flex-1">
              
              {/* Visualizador de la Captura */}
              <div className="flex-1 relative min-h-[380px] max-h-[550px] overflow-hidden bg-black/60 flex items-center justify-center p-4">
                {currentUrl ? (
                  <motion.div
                    animate={{ rotate: rotation, scale: scale }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="relative max-w-full max-h-full flex items-center justify-center"
                  >
                    <img
                      src={currentUrl}
                      alt="Evidencia cargada"
                      className="max-w-full max-h-[500px] object-contain rounded-lg shadow-2xl pointer-events-none"
                      draggable={false}
                    />
                  </motion.div>
                ) : (
                  <div className="text-white/30 text-xs italic flex flex-col items-center gap-2">
                    <Eye className="w-8 h-8 opacity-40" />
                    No hay captura adjunta
                  </div>
                )}
              </div>

              {/* Panel Lateral de Detalles */}
              {hasDetails && showSidebar && (
                <div className="w-full md:w-[320px] bg-black/40 border-t md:border-t-0 md:border-l border-white/5 flex flex-col p-5 overflow-y-auto max-h-[550px]">
                  <div className="space-y-5">
                    
                    {/* Encabezado del Equipo */}
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-neon-cyan bg-neon-cyan/15 px-2.5 py-1 rounded-full">
                        Datos Reportados
                      </span>
                      <h3 className="text-lg font-orbitron font-extrabold text-white mt-2 truncate">
                        {submissionDetails.teamName}
                      </h3>
                    </div>

                    {/* Resumen de Puntuaciones */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Top Logrado</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Trophy className={`w-4 h-4 ${submissionDetails.potTop ? 'text-gold' : 'text-white/50'}`} />
                          <span className={`text-base font-orbitron font-black ${submissionDetails.potTop ? 'text-gold' : 'text-white'}`}>
                            {submissionDetails.rank ? `#${submissionDetails.rank}` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Kills Equipo</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users className="w-4 h-4 text-neon-cyan" />
                          <span className="text-base font-orbitron font-black text-neon-cyan">
                            {submissionDetails.killCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Desglose de Jugadores */}
                    {submissionDetails.playerKillsBreakdown && submissionDetails.playerKillsBreakdown.length > 0 && (
                      <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-2">
                        <h4 className="text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-1.5">
                          Desglose Individual
                        </h4>
                        <div className="space-y-1.5">
                          {submissionDetails.playerKillsBreakdown.map((pk, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs text-white/70">
                              <span className="truncate pr-2 font-medium">{pk.name}</span>
                              <span className="font-orbitron font-black text-neon-cyan bg-neon-cyan/5 px-2 py-0.5 rounded border border-neon-cyan/10">
                                {pk.kills}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validación IA */}
                    {submissionDetails.aiStatus && (
                      <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                          <h4 className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                            Validación de IA
                          </h4>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                            submissionDetails.aiStatus === 'completed' 
                              ? 'bg-green-500/15 text-green-400' 
                              : submissionDetails.aiStatus === 'processing'
                              ? 'bg-yellow-500/15 text-yellow-400 animate-pulse'
                              : 'bg-red-500/15 text-red-400'
                          }`}>
                            {submissionDetails.aiStatus === 'completed' ? 'Listo' : submissionDetails.aiStatus === 'processing' ? 'Analizando' : 'Error'}
                          </span>
                        </div>

                        {submissionDetails.aiStatus === 'completed' && submissionDetails.aiData && (
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1">
                              <span className="text-white/50">Top Detectado:</span>
                              <span className={`font-orbitron font-bold ${hasRankDiscrepancy ? 'text-red-400 flex items-center gap-1 font-black' : 'text-white'}`}>
                                #{submissionDetails.aiData.rank}
                                {hasRankDiscrepancy && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                              </span>
                            </div>
                            
                            <div className="flex justify-between py-1">
                              <span className="text-white/50">Kills Detectadas:</span>
                              <span className={`font-orbitron font-bold ${hasKillsDiscrepancy ? 'text-red-400 flex items-center gap-1 font-black' : 'text-neon-cyan'}`}>
                                {submissionDetails.aiData.kill_count}
                                {hasKillsDiscrepancy && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                              </span>
                            </div>

                            {/* Alertas de Discrepancias */}
                            {(hasKillsDiscrepancy || hasRankDiscrepancy) && (
                              <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-500 leading-relaxed font-semibold">
                                ⚠️ Discrepancia encontrada: Revisa detenidamente la imagen seleccionada contra los datos reportados.
                              </div>
                            )}
                          </div>
                        )}
                        
                        {submissionDetails.aiStatus === 'failed' && (
                          <span className="text-[10px] text-red-400/80 block leading-normal italic">
                            No se pudo escanear automáticamente la imagen.
                          </span>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}

            </div>

            {/* Barra de herramientas / Toolbar inferior */}
            <div className="px-5 py-3 bg-[#0a0a0f]/80 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomIn}
                  type="button"
                  className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-white/70 hover:text-white transition-all flex items-center justify-center"
                  title="Acercar zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  type="button"
                  className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-white/70 hover:text-white transition-all flex items-center justify-center"
                  title="Alejar zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  type="button"
                  className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-white/70 hover:text-white transition-all flex items-center justify-center"
                  title="Rotar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReset}
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-xs text-white/60 hover:text-white transition-all"
                  title="Restablecer vista"
                >
                  Restaurar
                </button>
              </div>

              <div className="text-[9px] uppercase font-bold tracking-widest text-white/30">
                Escala: {Math.round(scale * 100)}% • Rotación: {rotation}°
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
