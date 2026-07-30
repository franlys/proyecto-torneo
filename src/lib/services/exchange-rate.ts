export async function getUsdToDopRate(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 } // Cache rate for 1 hour
    })
    if (!res.ok) throw new Error('Failed to fetch exchange rate')
    const data = await res.json()
    const rate = data.rates?.DOP
    if (typeof rate === 'number' && rate > 0) {
      return rate
    }
    return 58.25 // Fallback rate if DOP not found
  } catch (err) {
    console.error('Error fetching exchange rate:', err)
    return 58.25 // Fallback rate on error
  }
}
