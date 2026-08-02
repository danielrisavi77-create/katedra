import './globals.css'
import { AuthProvider } from '@/lib/hooks/useAuth'

export const metadata = {
  title: 'Katedra — od teme do predaje',
  description: 'AI kopilot za seminarski, završni i diplomski rad.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="hr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
