import { NextResponse } from 'next/server'

export function proxy(request) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()
  
  // Apply security headers to API routes (moved from pages/api/_proxy.js)
  if (pathname.startsWith('/api/')) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    
    // Add Content Security Policy
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.airtable.com https://app.loops.so https://slack.com https://hackatime.hackclub.com; frame-ancestors 'none';"
    )
  }
  
  // Apply Godot headers to My Games and Global Games pages
  if (pathname === '/my-games' || pathname === '/global-games' || 
      pathname.startsWith('/my-games/') || pathname.startsWith('/global-games/')) {
    
    // Set the headers required for Godot Cross-Origin Isolation
    response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
  }
  
  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    '/my-games',
    '/global-games',
    '/my-games/:path*',
    '/global-games/:path*'
  ]
}
