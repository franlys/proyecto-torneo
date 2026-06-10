import type { AdBanner } from '@/lib/actions/federation'
import Link from 'next/link'

interface AdPlacementProps {
  banners: AdBanner[]
  slotName: string
}

export function AdPlacement({ banners, slotName }: AdPlacementProps) {
  const activeAd = banners.find(b => b.slotName === slotName)

  if (!activeAd) {
    return (
      <div className="w-full bg-[#121219]/20 border border-dashed border-white/5 rounded-3xl p-6 text-center text-xs text-white/20 uppercase tracking-widest font-black">
        Espacio publicitario disponible para patrocinadores oficiales FDDE x KRONIX
      </div>
    )
  }

  const content = (
    <div className="relative group w-full overflow-hidden rounded-3xl border border-white/5 bg-[#121219]/40 hover:border-neon-cyan/20 transition-all duration-300">
      <img
        src={activeAd.imageUrl}
        alt={activeAd.advertiserName}
        className="w-full object-cover h-full min-h-[90px] max-h-[160px] opacity-75 group-hover:opacity-90 group-hover:scale-[1.01] transition-all duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent flex items-center px-8">
        <div>
          <span className="text-[8px] bg-neon-cyan text-black px-2 py-0.5 rounded-full font-black uppercase tracking-widest mb-1.5 inline-block">
            Patrocinador
          </span>
          <h5 className="font-bold text-white text-sm sm:text-base uppercase tracking-tight">
            {activeAd.advertiserName}
          </h5>
        </div>
      </div>
      <div className="absolute right-4 bottom-4 text-[8px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors">
        Anuncio ℹ️
      </div>
    </div>
  )

  if (activeAd.clickThroughUrl) {
    return (
      <Link href={activeAd.clickThroughUrl} target="_blank" className="block w-full">
        {content}
      </Link>
    )
  }

  return content
}
