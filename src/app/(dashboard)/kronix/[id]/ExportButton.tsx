'use client'

import { useState } from 'react'
import { exportTournamentDataCsv } from '@/lib/actions/export'
import { toast } from 'sonner'

export function ExportButton({ id, tournamentName }: { id: string, tournamentName: string }) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await exportTournamentDataCsv(id)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        // Create a blob and download it
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `Resultados_${tournamentName.replace(/\s+/g, '_')}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Reporte generado exitosamente')
      }
    } catch (err: any) {
      toast.error('Error al exportar los datos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-6 py-2.5 rounded-xl
        font-semibold text-sm text-white bg-white/5 border border-white/10
        hover:bg-white/10 hover:border-white/20 active:scale-[0.97] transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <svg className={`w-4 h-4 text-white/40 group-hover:text-white transition-colors ${loading ? 'animate-bounce' : ''}`} 
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {loading ? 'Generando...' : 'Exportar Resultados'}
    </button>
  )
}
