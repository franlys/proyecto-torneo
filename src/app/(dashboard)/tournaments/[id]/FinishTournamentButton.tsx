'use client'

import { useState, useRef } from 'react'
import { finishTournament } from '@/lib/actions/tournaments'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

export function FinishTournamentButton({ id }: { id: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result as string)
      reader.readAsDataURL(selected)
    }
  }

  const handleFinish = async () => {
    setIsPending(true)
    let imageUrl = ''

    try {
      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${id}-champion.${fileExt}`
        const filePath = `champions/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('evidences') // Usamos el mismo bucket por simplicidad pero ruta /champions/
          .upload(filePath, file, { upsert: true })

        if (uploadError) throw uploadError
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('evidences')
          .getPublicUrl(filePath)
        
        imageUrl = publicUrl
      }

      const result = await finishTournament(id, imageUrl)
      if (result && 'error' in result) {
        alert(result.error)
      } else {
        router.refresh()
        setIsOpen(false)
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo finalizar el torneo'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
          font-orbitron font-black text-xs text-gold border border-gold/30 bg-gold/5
          hover:bg-gold/10 active:scale-[0.98] transition-all duration-150
          shadow-lg shadow-gold/5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 3l14 9-14 9V3z" />
        </svg>
        Finalizar Torneo
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-dark-card border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl"
            >
              <h2 className="font-orbitron font-black text-xl text-white mb-2 uppercase tracking-tight">
                Momento de Gloria
              </h2>
              <p className="text-white/40 text-xs mb-6 leading-relaxed">
                Vas a finalizar el torneo. Sube una foto del equipo ganador o del podio para inmortalizarlos en el Hall of Fame.
              </p>

              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative group cursor-pointer aspect-video rounded-2xl border-2 border-dashed border-white/10 
                  bg-white/[0.02] flex flex-col items-center justify-center overflow-hidden hover:border-gold/50 transition-colors"
              >
                {preview ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Subir Foto de Victoria</span>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-6 py-3 rounded-xl bg-white/5 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleFinish}
                  disabled={isPending}
                  className="px-6 py-3 rounded-xl bg-gold text-black text-xs font-black uppercase tracking-tight hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : 'Finalizar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
