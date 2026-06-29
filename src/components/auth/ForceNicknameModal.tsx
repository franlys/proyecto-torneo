'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import { Loader2, ShieldAlert, Check } from 'lucide-react'

const orbitron = Orbitron({ subsets: ['latin'] })

export function ForceNicknameModal() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [nickname, setNickname] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  // 1. Listen for auth changes and load profile
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        checkProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setShowModal(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        checkProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setShowModal(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('Error fetching profile in ForceNicknameModal:', error)
        // If profile doesn't exist, we don't block yet, as the trigger might be creating it
        return
      }

      setProfile(data)
      
      // If profile exists but has NO username set, force the modal
      if (!data.username || data.username.trim() === '') {
        setShowModal(true)
      } else {
        setShowModal(false)
      }
    } catch (err) {
      console.error('Unexpected error checking profile:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const cleanNickname = nickname.trim()

    // Validation
    if (cleanNickname.length < 3) {
      setError('El nickname debe tener al menos 3 caracteres.')
      return
    }

    if (cleanNickname.length > 20) {
      setError('El nickname no puede superar los 20 caracteres.')
      return
    }

    // Regexp for safe nickname: alphanumeric and underscores only
    if (!/^[a-zA-Z0-9_]+$/.test(cleanNickname)) {
      setError('El nickname solo puede contener letras, números y guiones bajos (_). Sin espacios ni caracteres especiales.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Update in profiles table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ username: cleanNickname })
        .eq('id', user.id)

      if (updateErr) {
        // If duplicate key error (uniqueness constraint on username)
        if (updateErr.code === '23505') {
          setError('Este nickname ya está en uso por otro usuario. Por favor, elige otro.')
        } else {
          setError(updateErr.message || 'Error al guardar el nickname.')
        }
        setIsLoading(false)
        return
      }

      // 2. Also update auth user metadata username so it is synchronized
      await supabase.auth.updateUser({
        data: { username: cleanNickname }
      })

      setSuccess(true)
      
      // Hide modal after short success animation
      setTimeout(() => {
        setProfile({ username: cleanNickname })
        setShowModal(false)
        setIsLoading(false)
        setSuccess(false)
        // Refresh page to propagate the new username
        window.location.reload()
      }, 1500)

    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.')
      setIsLoading(false)
    }
  }

  if (!showModal) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop filter blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-md"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative w-full max-w-md bg-[#0c0c12] border border-white/5 p-8 rounded-3xl shadow-2xl flex flex-col gap-6 text-center z-10"
        >
          {/* Logo header */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-cyan mb-1 font-orbitron">
              Registro Obligatorio
            </span>
            <h1 className={`${orbitron.className} text-2xl font-black uppercase tracking-widest text-white`}>
              KRONIX
            </h1>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              ¡Hola! Configura tu Nickname
            </h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Para poder participar en los torneos, comprar boletos de sorteos y figurar en los rankings oficiales, necesitas definir tu apodo oficial.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block">
                Tu Apodo / Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value.replace(/\s+/g, '')) // Prevents spaces instantly
                  setError(null)
                }}
                disabled={isLoading || success}
                placeholder="Ej: GamerPro_10"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white text-xs font-bold rounded-xl outline-none transition-all placeholder:text-white/20 disabled:opacity-50"
                maxLength={20}
              />
            </div>

            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-xl flex items-start gap-2 text-left">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success ? (
              <div className="py-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
                <Check size={16} /> ¡Nickname configurado con éxito!
              </div>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-neon-cyan to-neon-purple text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  'Confirmar Nickname'
                )}
              </button>
            )}
          </form>

          <div className="text-[9px] text-white/20 uppercase tracking-wider leading-relaxed">
            Este apodo no podrá cambiarse fácilmente para mantener el histórico de estadísticas limpio y justo.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
