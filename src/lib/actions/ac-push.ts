'use server'

// pushToAC — fires a webhook to ArenaCrypto after PT mutations.
// AC stores a local mirror so its pages don't need cross-DB queries.
// Fire-and-forget: never blocks the PT response.

const AC_URL  = process.env.AC_WEBHOOK_URL ?? 'https://arena-crypto.vercel.app'
const SECRET  = process.env.AC_WEBHOOK_SECRET ?? ''

type PushTable = 'tournaments' | 'teams' | 'participants' | 'matches'
type PushEvent = 'upsert' | 'delete'

export async function pushToAC(
  table: PushTable,
  event: PushEvent,
  data: Record<string, unknown>
): Promise<void> {
  if (!SECRET) return // skip if not configured

  const url = `${AC_URL}/api/webhooks/pt-sync`

  try {
    await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ac-secret':  SECRET,
      },
      body: JSON.stringify({ event, table, data }),
    })
  } catch {
    // Fire-and-forget — never throw, never block PT response
  }
}
