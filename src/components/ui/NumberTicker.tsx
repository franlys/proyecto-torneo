'use client'

import { useEffect, useRef } from 'react'
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
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => latest.toFixed(precision))
  const prevValue = useRef(value)

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 0.8,
      ease: 'easeOut',
    })
    return () => controls.stop()
  }, [value, count])

  return (
    <motion.span className={className}>
      {rounded}
    </motion.span>
  )
}
