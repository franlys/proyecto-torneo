// Unified Player Ranks Scale (Hybrid calculation: points + activity)

export interface TierRank {
  name: string;
  minPoints: number;
  color: string;
}

export const TIER_RANKS: TierRank[] = [
  { name: 'Elite', minPoints: 1000, color: '#FFD700' },       // Oro Brillante
  { name: 'High AM', minPoints: 700, color: '#c084fc' },     // Violeta Claro
  { name: 'AM', minPoints: 450, color: '#60a5fa' },          // Azul Brillante
  { name: 'Low AM', minPoints: 250, color: '#38bdf8' },      // Celeste
  { name: 'High Detry', minPoints: 150, color: '#f87171' },  // Rojo Suave
  { name: 'Detry', minPoints: 50, color: '#9ca3af' },        // Gris
  { name: 'Low Detry', minPoints: 0, color: '#6b7280' },     // Gris Oscuro
];

/**
 * Calculates the dynamic TierRank for a user based on their discipline points.
 */
export function getRankFromPoints(points: number): TierRank {
  const pts = Number(points || 0);
  return TIER_RANKS.find(r => pts >= r.minPoints) || TIER_RANKS[TIER_RANKS.length - 1];
}

/**
 * Normalizes text-based ranks (manual fallback) and returns their representative color.
 */
export function getRankColor(rankName?: string | null): string {
  if (!rankName) return '#6b7280'; // Default Low Detry color
  
  const norm = rankName.toLowerCase().trim();
  
  // Exact match from TIER_RANKS
  const matched = TIER_RANKS.find(r => r.name.toLowerCase() === norm);
  if (matched) return matched.color;
  
  // Partial matches for fallback
  if (norm.includes('elite') || norm.includes('predator')) return '#FFD700';
  if (norm.includes('high am') || norm.includes('diamante') || norm.includes('master')) return '#c084fc';
  if (norm.includes('low am') || norm.includes('platino')) return '#38bdf8';
  if (norm.includes('am') || norm.includes('plata') || norm.includes('azul')) return '#60a5fa';
  if (norm.includes('high detry') || norm.includes('rojo')) return '#f87171';
  if (norm.includes('low detry')) return '#6b7280';
  if (norm.includes('detry') || norm.includes('bronce') || norm.includes('gris')) return '#9ca3af';
  if (norm.includes('oro') || norm.includes('gold')) return '#fbbf24';
  
  return '#ffffff';
}
