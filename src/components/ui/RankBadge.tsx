'use client'

import React from 'react'
import { getRankFromPoints, getRankColor } from '@/lib/rankings'

interface RankBadgeProps {
  rankName?: string | null
  points?: number
  size?: 'sm' | 'md' | 'lg'
}

export function RankBadge({ rankName, points, size = 'sm' }: RankBadgeProps) {
  // Resolve rank name and color
  let name = rankName || 'Low Detry'
  let color = '#6b7280'

  if (points !== undefined && points !== null) {
    const rankInfo = getRankFromPoints(points)
    name = rankInfo.name
    color = rankInfo.color
  } else {
    color = getRankColor(name)
  }

  const cleanName = name.toLowerCase().trim()
  const isElite = cleanName.includes('elite')
  const isHighAM = cleanName.includes('high am')
  const isLowAM = cleanName.includes('low am')
  const isAM = cleanName.includes('am') && !isHighAM && !isLowAM
  const isHighDetry = cleanName.includes('high detry')
  const isLowDetry = cleanName.includes('low detry')
  const isDetry = cleanName.includes('detry') && !isHighDetry && !isLowDetry

  // Custom icon based on rank
  let icon = '⚙️'
  if (isElite) icon = '👑'
  else if (isHighAM) icon = '⚡'
  else if (isAM) icon = '🛡️'
  else if (isLowAM) icon = '🎖️'
  else if (isHighDetry) icon = '⚔️'
  else if (isLowDetry) icon = '💀'

  // Neon glow shadows
  const glowStyle = isElite 
    ? {
        textShadow: `0 0 10px ${color}88`,
        boxShadow: `0 0 15px ${color}35, inset 0 0 6px ${color}25`,
        borderColor: `${color}70`,
        backgroundColor: `${color}15`,
      }
    : isHighAM || isAM
      ? {
          textShadow: `0 0 6px ${color}66`,
          boxShadow: `0 0 10px ${color}20`,
          borderColor: `${color}55`,
          backgroundColor: `${color}10`,
        }
      : {
          borderColor: `${color}35`,
          backgroundColor: `${color}0a`,
        }

  // Size configurations
  const sizeClasses = size === 'lg' 
    ? 'px-3 py-1 text-[10px] gap-1.5' 
    : size === 'md' 
      ? 'px-2 py-0.75 text-[8.5px] gap-1' 
      : 'px-1.5 py-0.5 text-[8px] gap-0.5'

  return (
    <span 
      className={`inline-flex items-center font-orbitron font-black uppercase tracking-wider rounded border transition-all duration-300 ${sizeClasses} select-none`}
      style={{
        color: color,
        ...glowStyle
      }}
    >
      <span className="text-[10px] filter drop-shadow-[0_0_2px_rgba(255,255,255,0.1)]">{icon}</span>
      <span>{name}</span>
    </span>
  )
}
