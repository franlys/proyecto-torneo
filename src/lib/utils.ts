import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOptimizedImageUrl(url?: string | null, width = 150, height = 150) {
  if (!url) return ''
  // Si el plan de Supabase es de nivel gratuito (Free Tier), la API de transformación (/render/image/) 
  // da error 404/403. Retornamos la URL directa del almacenamiento para asegurar la visualización.
  return url
}
