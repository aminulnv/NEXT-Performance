import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/contexts/AuthContext'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import App from './App'
import { applyDocumentBranding, applyThemeVariables } from '@/config/assets'
import './index.css'
import './styles/performance.css'

applyThemeVariables()
applyDocumentBranding()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PermissionsProvider>
        <SettingsProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </SettingsProvider>
      </PermissionsProvider>
    </AuthProvider>
  </StrictMode>,
)
