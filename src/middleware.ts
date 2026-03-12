import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth middleware — beschermt /portal/* routes.
 * Niet-ingelogde gebruikers worden doorgestuurd naar /portal/login.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes die GEEN auth nodig hebben
  const publicPaths = ['/portal/login', '/portal/register', '/portal/auth/callback', '/portal/reset-password', '/portal/bevestigd']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh de sessie (belangrijk voor @supabase/ssr)
  const { data: { user } } = await supabase.auth.getUser()

  // Niet ingelogd → redirect naar login
  if (!user && pathname.startsWith('/portal')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/portal/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/portal/:path*'],
}
