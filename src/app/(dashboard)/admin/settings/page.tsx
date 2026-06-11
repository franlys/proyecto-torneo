import { getLandingSettings } from '@/lib/actions/landing-settings'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'

export default async function AdminSettingsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const settings = await getLandingSettings()

  return <SettingsClient initialSettings={settings} />
}
