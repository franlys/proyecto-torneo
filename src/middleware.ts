import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export async function middleware(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            try {
              return request.cookies.getAll()
            } catch {
              return []
            }
          },
          setAll(cookiesToSet: CookieToSet[]) {
            try {
              cookiesToSet.forEach(({ name, value }) => {
                try {
                  request.cookies.set(name, value)
                } catch {}
              })
              supabaseResponse = NextResponse.next({ request })
              cookiesToSet.forEach(({ name, value, options }) => {
                try {
                  supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
                } catch {}
              })
            } catch {}
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Protect dashboard routes
    if (!user && request.nextUrl.pathname.startsWith('/tournaments')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware error:', error)
    // Fallback: redirect to login if we can't determine auth status for protected routes
    if (request.nextUrl.pathname.startsWith('/tournaments')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: ['/tournaments/:path*'],
}
