import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

Sentry.init({
  dsn: 'https://a5f8192c23557dbbad2994192540cb82@o4511078793740288.ingest.us.sentry.io/4511078817792000',
  sendDefaultPii: false,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


