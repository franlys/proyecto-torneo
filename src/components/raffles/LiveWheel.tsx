'use client'

import React, { useRef, useEffect, useState } from 'react'
import confetti from 'canvas-confetti'

interface Participant {
  id: string
  name: string
  ticketNumber: string
}

interface LiveWheelProps {
  participants: Participant[]
  onDrawComplete: (winner: Participant) => void
  triggerSpin: boolean
}

export function LiveWheel({
  participants,
  onDrawComplete,
  triggerSpin,
}: LiveWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [currentWinner, setCurrentWinner] = useState<Participant | null>(null)

  // Sonido de clic generado con la Web Audio API nativa
  const playTickSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(800, audioCtx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.08)
      
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08)
      
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      
      osc.start()
      osc.stop(audioCtx.currentTime + 0.08)
    } catch (e) {
      // AudioContext bloqueado por política del navegador
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let startAngle = 0
    
    // Lista de fallback si no hay suficientes participantes
    const list = participants.length > 0 
      ? participants 
      : Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, name: `Boleto #${i+1}`, ticketNumber: `000${i+1}` }))
      
    const numSegments = list.length
    const arc = (2 * Math.PI) / numSegments
    
    let spinAngleStart = 0
    let spinTime = 0
    let spinTimeTotal = 0

    const drawRouletteWheel = (angleOffset = 0) => {
      const size = Math.min(canvas.width, canvas.height)
      const center = size / 2
      const radius = center - 15

      ctx.clearRect(0, 0, size, size)

      // Sombra detrás de la ruleta
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
      ctx.shadowBlur = 20
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 6

      // Dibujar segmentos
      for (let i = 0; i < numSegments; i++) {
        const angle = angleOffset + i * arc
        
        // Colores oscuros premium para los segmentos de Kronix
        ctx.fillStyle = i % 2 === 0 ? '#0a0a0f' : '#12121e'
        
        ctx.beginPath()
        ctx.arc(center, center, radius, angle, angle + arc, false)
        ctx.lineTo(center, center)
        ctx.fill()

        // Línea del borde del segmento (neon sutil)
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.08)'
        ctx.lineWidth = 1
        ctx.stroke()

        // Dibujar símbolos neutros
        ctx.save()
        ctx.shadowBlur = 0
        ctx.shadowColor = 'transparent'
        ctx.fillStyle = '#ffffff'
        ctx.translate(
          center + Math.cos(angle + arc / 2) * (radius * 0.72),
          center + Math.sin(angle + arc / 2) * (radius * 0.72)
        )
        ctx.rotate(angle + arc / 2 + Math.PI / 2)
        
        ctx.font = '16px Outfit, system-ui, sans-serif'
        const label = i % 2 === 0 ? '👑' : '🍀'
        ctx.fillText(label, -ctx.measureText(label).width / 2, 0)
        ctx.restore()
      }

      // Aro exterior (Neon Cyan de Kronix)
      ctx.shadowColor = 'rgba(0, 245, 255, 0.4)'
      ctx.shadowBlur = 12
      ctx.strokeStyle = '#00f5ff'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, 2 * Math.PI)
      ctx.stroke()

      // Aro interior decorativo (Neon Purple)
      ctx.strokeStyle = 'rgba(176, 38, 255, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(center, center, radius - 18, 0, 2 * Math.PI)
      ctx.stroke()

      // Botón central de la ruleta (Brillo Neon Purple)
      ctx.fillStyle = '#b026ff'
      ctx.shadowColor = 'rgba(176, 38, 255, 0.8)'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(center, center, 22, 0, 2 * Math.PI)
      ctx.fill()

      // Núcleo central luminoso
      ctx.fillStyle = '#00f5ff'
      ctx.shadowColor = 'rgba(0, 245, 255, 0.9)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(center, center, 6, 0, 2 * Math.PI)
      ctx.fill()

      // Flecha indicadora superior (Neon Pink/Red)
      ctx.shadowBlur = 6
      ctx.fillStyle = '#ff0055'
      ctx.beginPath()
      ctx.moveTo(center - 10, center - radius - 8)
      ctx.lineTo(center + 10, center - radius - 8)
      ctx.lineTo(center, center - radius + 14)
      ctx.closePath()
      ctx.fill()
      
      // Borde del indicador
      ctx.strokeStyle = '#00f5ff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    let currentAngle = startAngle
    let lastTickAngle = 0

    const rotateWheel = () => {
      spinTime += 30
      if (spinTime >= spinTimeTotal) {
        setSpinning(false)
        
        // Calcular el boleto ganador definitivo
        const degrees = (currentAngle * 180) / Math.PI + 90
        const arcd = (arc * 180) / Math.PI
        const index = Math.floor((360 - (degrees % 360)) / arcd) % numSegments
        const finalWinner = list[index >= 0 ? index : 0]
        
        setCurrentWinner(finalWinner)
        onDrawComplete(finalWinner)

        // Celebración con confetti (colores Kronix: cyan, purple, blanco)
        confetti({
          particleCount: 180,
          spread: 90,
          origin: { y: 0.65 },
          colors: ['#00f5ff', '#b026ff', '#ffffff']
        })
        return
      }

      // Easing de giro
      const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal)
      currentAngle += (spinAngle * Math.PI) / 180
      
      // Emitir sonido en la transición de cada segmento
      const currentAngleDeg = (currentAngle * 180) / Math.PI
      if (Math.floor(currentAngleDeg / (360 / numSegments)) !== Math.floor(lastTickAngle / (360 / numSegments))) {
        playTickSound()
        lastTickAngle = currentAngleDeg
      }

      drawRouletteWheel(currentAngle)
      animationFrameId = requestAnimationFrame(rotateWheel)
    }

    const easeOut = (t: number, b: number, c: number, d: number) => {
      const ts = (t /= d) * t
      const tc = ts * t
      return b + c * (tc + -3 * ts + 3 * t)
    }

    if (triggerSpin && !spinning) {
      setSpinning(true)
      setCurrentWinner(null)
      spinAngleStart = Math.random() * 12 + 15 // Velocidad inicial aleatoria
      spinTime = 0
      spinTimeTotal = Math.random() * 2000 + 5000 // Duración de 5s a 7s
      rotateWheel()
    } else {
      drawRouletteWheel(currentAngle)
    }

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [participants, triggerSpin])

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative mb-6">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          style={{ width: '360px', height: '360px' }}
          className="rounded-full shadow-2xl border border-white/5 bg-black/10"
        />
      </div>

      {currentWinner && (
        <div className="p-6 bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-neon-cyan/20 rounded-2xl text-center max-w-sm shadow-[0_0_20px_rgba(0,245,255,0.05)] animate-bounce mt-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-neon-cyan font-orbitron">
            🎉 ¡BOLETO GANADOR!
          </h4>
          <h2 className="text-4xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple mt-1 leading-none">
            #{currentWinner.ticketNumber}
          </h2>
          <p className="text-sm text-white/70 mt-3 font-semibold font-orbitron uppercase tracking-wider">
            {currentWinner.name}
          </p>
        </div>
      )}

      {spinning && (
        <div className="text-center mt-4">
          <p className="text-xs font-orbitron font-black text-neon-cyan animate-pulse uppercase tracking-wider">
            Girando la ruleta del destino...
          </p>
        </div>
      )}
    </div>
  )
}
