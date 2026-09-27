import { Route, Routes } from 'react-router-dom'
import { SnapshotProvider } from './data/SnapshotProvider'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { LandingPage } from './pages/LandingPage'
import { MapWorkspacePage } from './pages/MapWorkspacePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlanningWizardPage } from './pages/PlanningWizardPage'
import { SiteShell } from './site/SiteShell'
import './styles.css'

interface AppProps {
  /** Injectable data fetcher for tests; defaults to `window.fetch`. */
  fetchImpl?: (input: string) => Promise<Response>
}

function App({ fetchImpl }: AppProps = {}) {
  return (
    <SnapshotProvider fetchImpl={fetchImpl}>
      <Routes>
        <Route element={<SiteShell />}>
          <Route index element={<LandingPage />} />
          <Route path="plan" element={<PlanningWizardPage />} />
          <Route path="map" element={<MapWorkspacePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SnapshotProvider>
  )
}

export default App
