'use client'

import { useState, useTransition } from 'react'
import { createUserByAdmin } from '@/lib/actions/admin'

export function CreateUserForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createUserByAdmin(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setIsOpen(false)
        const form = e.target as HTMLFormElement
        form.reset()
        // Wait 3 seconds and clear success message
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">Crear Nuevo Usuario</h2>
          <p className="text-white/40 text-xs mt-0.5">Registra una cuenta de administrador, federación o streamer directamente.</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-white text-black text-xs font-black uppercase tracking-widest rounded-lg hover:bg-neon-cyan hover:text-black transition-colors"
        >
          {isOpen ? 'Cancelar' : 'Agregar Usuario'}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5 text-sm">
          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Nombre de Usuario (Username)</label>
            <input
              required
              name="username"
              placeholder="Ej: federacion_sf"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-neon-cyan outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Email</label>
            <input
              required
              type="email"
              name="email"
              placeholder="Ej: federacion@kronix.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-neon-cyan outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Contraseña (Mín. 6 caracteres)</label>
            <input
              required
              type="password"
              name="password"
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-neon-cyan outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black tracking-widest text-white/40 mb-1.5">Rol en la plataforma</label>
            <select
              name="role"
              defaultValue="FEDERATION"
              className="w-full bg-[#121219] border border-white/10 rounded-xl px-4 py-2 text-white focus:border-neon-cyan outline-none"
            >
              <option value="USER">USER</option>
              <option value="STREAMER">STREAMER (Creador de Torneo)</option>
              <option value="FEDERATION">FEDERATION (Gestor Oficial)</option>
              <option value="ADMIN">ADMIN (Super Administrador)</option>
            </select>
          </div>

          {error && (
            <div className="md:col-span-2 text-red-500 text-xs font-semibold bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="md:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 bg-neon-cyan text-black font-black uppercase tracking-widest rounded-lg hover:bg-neon-cyan/85 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Guardando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      )}

      {success && (
        <div className="text-green-400 text-xs font-semibold bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg">
          Usuario creado exitosamente. Se ha registrado su perfil en la base de datos.
        </div>
      )}
    </div>
  )
}
