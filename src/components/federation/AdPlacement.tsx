'use client'

import type { AdBanner } from '@/lib/actions/federation'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import { useMemo, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface AdPlacementProps {
  banners: AdBanner[]
  slotName: string
  tournamentId?: string
  hidePlaceholder?: boolean
}

export function AdPlacement({ banners, slotName, tournamentId, hidePlaceholder }: AdPlacementProps) {
  const matchingAds = useMemo(() => {
    return banners.filter(b => b.slotName === slotName && b.isActive)
  }, [banners, slotName])

  const [currentIndex, setCurrentIndex] = useState(0)

  // Auto-play interval
  useEffect(() => {
    if (matchingAds.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % matchingAds.length)
    }, 6000) // Cambiar slide cada 6 segundos
    return () => clearInterval(interval)
  }, [matchingAds])

  if (matchingAds.length === 0) {
    if (hidePlaceholder) return null
    return (
      <div className="w-full bg-[#121219]/20 border border-dashed border-white/5 rounded-3xl p-6 text-center text-xs text-white/20 uppercase tracking-widest font-black">
        Espacio publicitario disponible para patrocinadores oficiales KRONIX
      </div>
    )
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex((prev) => (prev - 1 + matchingAds.length) % matchingAds.length)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex((prev) => (prev + 1) % matchingAds.length)
  }

  const handleDotClick = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(index)
  }

  const activeAd = matchingAds[currentIndex]

  const handleClick = () => {
    trackEvent({
      tournamentId,
      eventType: 'click_ad',
      metadata: {
        slotName,
        advertiserName: activeAd.advertiserName,
        clickThroughUrl: activeAd.clickThroughUrl
      }
    })
  }

  const isVideo = activeAd.imageUrl.toLowerCase().match(/\.(mp4|webm|ogg)$/) || activeAd.imageUrl.includes('/video/')

  const content = (
    <div className="relative group w-full overflow-hidden rounded-3xl border border-white/5 bg-[#121219]/40 hover:border-neon-cyan/20 transition-all duration-300 min-h-[90px] max-h-[160px] flex items-center">
      {/* Slide Container */}
      <div className="relative w-full h-full min-h-[90px] max-h-[160px] overflow-hidden flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeAd.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 w-full h-full flex items-center"
          >
            {isVideo ? (
              <video
                src={activeAd.imageUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-70 group-hover:opacity-85 transition-opacity duration-500"
              />
            ) : (
              <img
                src={activeAd.imageUrl}
                alt={activeAd.advertiserName}
                className="w-full h-full object-cover opacity-70 group-hover:opacity-85 transition-opacity duration-500"
              />
            )}
            
            {/* Banner overlay text */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/30 to-transparent flex items-center px-8 pointer-events-none">
              <div>
                <span className="text-[8px] bg-neon-cyan text-black px-2 py-0.5 rounded-full font-black uppercase tracking-widest mb-1.5 inline-block">
                  Patrocinador
                </span>
                <h5 className="font-bold text-white text-sm sm:text-base uppercase tracking-tight">
                  {activeAd.advertiserName}
                </h5>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Info Tag */}
      <div className="absolute right-4 bottom-4 text-[8px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors pointer-events-none z-10">
        Anuncio ℹ️
      </div>

      {/* Navigation Arrows */}
      {matchingAds.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-neon-cyan hover:text-black hover:border-neon-cyan transition-all duration-300 z-20 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-neon-cyan hover:text-black hover:border-neon-cyan transition-all duration-300 z-20 cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
            {matchingAds.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => handleDotClick(idx, e)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'bg-neon-cyan w-3'
                    : 'bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )

  if (activeAd.clickThroughUrl) {
    return (
      <Link href={activeAd.clickThroughUrl} target="_blank" className="block w-full" onClick={handleClick}>
        {content}
      </Link>
    )
  }

  return (
    <div onClick={handleClick} className="cursor-pointer w-full">
      {content}
    </div>
  )
}
