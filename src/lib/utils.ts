import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOptimizedImageUrl(url?: string | null, width = 150, height = 150) {
  if (!url) return ''
  if (url.includes('supabase.co') && url.includes('/object/public/')) {
    return `${url.replace('/object/public/', '/render/image/public/')}?width=${width}&height=${height}&resize=contain`
  }
  return url
}
