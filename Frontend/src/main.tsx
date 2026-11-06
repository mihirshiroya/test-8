import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { IS_DESKTOP } from './lib/api-origin'

// The desktop floating timer window loads this same bundle on its own route
// and renders only the lightweight timer, without the dashboard shell.
const FloatingApp = lazy(() => import('./desktop/FloatingApp'))
const CheckinApp = lazy(() => import('./desktop/CheckinApp'))
const isFloatingWindow = IS_DESKTOP && window.location.pathname.startsWith('/floating-timer')
const isCheckinWindow = IS_DESKTOP && window.location.pathname.startsWith('/checkin')

createRoot(document.getElementById('root')!).render(
  isFloatingWindow ? (
    <Suspense fallback={null}>
      <FloatingApp />
    </Suspense>
  ) : isCheckinWindow ? (
    <Suspense fallback={null}>
      <CheckinApp />
    </Suspense>
  ) : (
    <App />
  ),
)
