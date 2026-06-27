'use client'

import React, { useState, useEffect } from 'react'

interface CountdownClockProps {
  targetDate: string | Date
  onExpire?: () => void
}

export function CountdownClock({ targetDate, onExpire }: CountdownClockProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(targetDate) - +new Date()
      
      if (difference <= 0) {
        if (onExpire && !timeLeft.isExpired) {
          onExpire()
        }
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true }
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false
      }
    }

    setTimeLeft(calculateTimeLeft())
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate, onExpire])

  const renderUnit = (value: number, label: string, max: number) => {
    const radius = 40
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (value / max) * circumference

    return (
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-white/5 fill-transparent stroke-[6]"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="stroke-neon-cyan fill-transparent stroke-[6] transition-all duration-1000 ease-linear shadow-lg"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg sm:text-xl font-orbitron font-black text-white leading-none">
            {value.toString().padStart(2, '0')}
          </span>
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-white/30 font-semibold mt-1">
            {label}
          </span>
        </div>
      </div>
    )
  }

  if (timeLeft.isExpired) {
    return (
      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center max-w-md mx-auto shadow-xl">
        <h3 className="text-base font-orbitron font-black text-neon-purple uppercase mb-1">¡Llegó la Hora!</h3>
        <p className="text-xs text-white/40">El sorteo ha comenzado o se cerrará pronto. ¡Mucha suerte a todos!</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 select-none">
      {renderUnit(timeLeft.days, 'Días', 365)}
      {renderUnit(timeLeft.hours, 'Horas', 24)}
      {renderUnit(timeLeft.minutes, 'Minutos', 60)}
      {renderUnit(timeLeft.seconds, 'Segundos', 60)}
    </div>
  )
}
