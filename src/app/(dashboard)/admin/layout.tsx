import { redirect } from 'next/navigation'
import { isAdmin, isSuperAdmin, getProfile } from '@/lib/actions/auth-helpers'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const allowed = await isAdmin()
  if (!allowed) {
    redirect('/tournaments')
  }

  const isSuperAdminUser = await isSuperAdmin()
  const profile = await getProfile()

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <main className="pt-20 lg:pt-8 pb-12 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
