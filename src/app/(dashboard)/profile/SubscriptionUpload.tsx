'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { requestSubscription } from '@/lib/actions/subscriptions'
import { useRouter } from 'next/navigation'

export function SubscriptionUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      setError('El archivo no puede superar los 5 MB')
      return
    }
    setFile(f)
    setError(null)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `subscription-evidence/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('evidences')
        .upload(path, file, { upsert: false })

      if (uploadError) throw new Error(uploadError.message)

      const { data: { publicUrl } } = supabase.storage
        .from('evidences')
        .getPublicUrl(path)

      const result = await requestSubscription(publicUrl)
      if ('error' in result) throw new Error(result.error)

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el comprobante')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          preview
            ? 'border-neon-purple/40 bg-neon-purple/5'
            : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
        }`}
      >
        {preview ? (
          <div className="space-y-2">
            <img src={preview} alt="Comprobante" className="max-h-40 mx-auto rounded-lg object-contain" />
            <p className="text-white/40 text-xs">{file?.name} · Clic para cambiar</p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg className="w-8 h-8 text-white/20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-white/40 text-sm">Sube el screenshot del pago</p>
            <p className="text-white/20 text-xs">PNG, JPG · Máx. 5 MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full py-3 bg-neon-purple text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {uploading ? 'Enviando solicitud...' : 'Enviar comprobante de pago'}
      </button>
    </form>
  )
}
