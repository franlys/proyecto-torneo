'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue, useTransform, motion } from 'framer-motion'

export function NumberTicker({
  value,
  precision = 0,
  className = '',
}: {
  value: number
  precision?: number
  className?: string
}) {
  const [isMounted, setIsMounted] = useState(false)
  const count = useMotionValue(value) // Initialize with final value for server match
  const rounded = useTransform(count, (latest) => latest.toFixed(precision))
  const prevValue = useRef(value)

  useEffect(() => {
    setIsMounted(true)
    // Restart from 0 to target if we want the actual "counting" effect upon first load
    // or just follow changes. Let's make it count from 0 to value on mount.
    animate(count, value, {
      duration: 1.2,
      ease: 'easeOut',
      from: 0 
    })
  }, [value, count])

  if (!isMounted) {
    return <span className={className}>{value.toFixed(precision)}</span>
  }

  return (
    <motion.span className={className}>
      {rounded}
    </motion.span>
  )
}
