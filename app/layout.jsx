import './globals.css'
import { AuthProvider } from '@/lib/hooks/useAuth'
import ScrollToTop from './scroll-to-top'
import { ThemeProvider } from './theme-provider'

export const metadata = {
  title: 'Katedra — od teme do obrane',
  description: 'AI kopilot za seminarski, završni i diplomski rad.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="hr" data-scroll-behavior="smooth">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ScrollToTop />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
