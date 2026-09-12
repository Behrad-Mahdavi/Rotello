import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/_next') || path.startsWith('/favicon.ico') || path.includes('.')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  function createRedirect(url: URL) {
    const redirectRes = NextResponse.redirect(url)
    // Copy cookies to the redirect response with their options preserved
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c)
    })
    return redirectRes
  }

  if (!user && path !== '/login' && path !== '/signup') {
    return createRedirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || (user.user_metadata?.role as string | undefined)

    if (path === '/login') {
      return createRedirect(
        new URL(role === 'admin' ? '/admin/members' : '/projects', request.url)
      )
    }

    if (path.startsWith('/admin') && role !== 'admin') {
      return createRedirect(new URL('/projects', request.url))
    }

    if (path === '/') {
      return createRedirect(
        new URL(role === 'admin' ? '/admin/members' : '/projects', request.url)
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
