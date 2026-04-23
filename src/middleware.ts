import { defineMiddleware } from 'astro:middleware'
import { clearAdminSession, hasAdminSession, refreshAdminSession } from '@/lib/admin-auth'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self'",
].join('; ')

function applySecurityHeaders(response: Response): Response {
  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'accelerometer=(), autoplay=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  )

  return response
}

function isAllowedOrigin(request: Request): boolean {
  if (request.method !== 'POST') return true

  const requestUrl = new URL(request.url)
  if (!requestUrl.pathname.startsWith('/api/')) return true

  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === requestUrl.origin
  } catch {
    return false
  }
}

function rejectCrossOrigin(request: Request): Response {
  const { pathname, origin } = new URL(request.url)

  if (pathname.startsWith('/api/admin/')) {
    return Response.redirect(`${origin}/admin/announcements?error=origin`, 303)
  }

  if (pathname === '/api/unsubscribe') {
    return Response.redirect(`${origin}/unsubscribe?status=invalid`, 303)
  }

  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function shouldManageAdminSession(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname === '/api/admin/announcements'
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!isAllowedOrigin(context.request)) {
    return applySecurityHeaders(rejectCrossOrigin(context.request))
  }

  if (shouldManageAdminSession(context.url.pathname)) {
    if (hasAdminSession(context.cookies)) {
      refreshAdminSession(context.cookies)
    } else if (context.cookies.get('devpulse-admin-session')) {
      clearAdminSession(context.cookies)
    }
  }

  const response = await next()
  return applySecurityHeaders(response)
})
