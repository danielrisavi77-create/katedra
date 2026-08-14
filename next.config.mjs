/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co https://*.supabase.io https://api.anthropic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.io",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join('; ')

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
          ...(isDev ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }]),
        ],
      },
    ]
  },
}

export default nextConfig
