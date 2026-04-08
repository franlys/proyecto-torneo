'use client'

import { Toaster as Sonner } from 'sonner'

export function ToastProvider() {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-dark-card group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-white/40",
          actionButton: "group-[.toast]:bg-neon-cyan group-[.toast]:text-black",
          cancelButton: "group-[.toast]:bg-white/5 group-[.toast]:text-white",
          error: "group-[.toast]:border-red-500/50 group-[.toast]:text-red-400",
          success: "group-[.toast]:border-neon-cyan/50 group-[.toast]:text-neon-cyan",
        },
      }}
    />
  )
}
