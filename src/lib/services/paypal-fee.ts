/**
 * Utility functions for calculating PayPal fees and gross charge amounts.
 * Standard PayPal transaction fee: 5.4% + $0.35 USD
 */

export function calculatePayPalGrossAmount(netAmount: number): {
  netAmount: number
  fee: number
  grossAmount: number
} {
  if (netAmount <= 0) {
    return { netAmount: 0, fee: 0, grossAmount: 0 }
  }

  const fixedFee = 0.35
  const percentage = 0.054 // 5.4%
  const gross = (netAmount + fixedFee) / (1 - percentage)
  const roundedGross = parseFloat(gross.toFixed(2))
  const fee = parseFloat((roundedGross - netAmount).toFixed(2))

  return {
    netAmount: parseFloat(netAmount.toFixed(2)),
    fee,
    grossAmount: roundedGross,
  }
}

export function calculateNetFromGross(grossAmount: number): number {
  if (grossAmount <= 0) return 0
  const fixedFee = 0.35
  const percentage = 0.054
  const net = grossAmount * (1 - percentage) - fixedFee
  return parseFloat(Math.max(0.01, net).toFixed(2))
}
