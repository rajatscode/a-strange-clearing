import { useState, useEffect, useCallback } from 'react'
import WorldCanvas from './components/WorldCanvas'
import NotesPage from './components/NotesPage'
import ArtifactsPage from './components/ArtifactsPage'
import BioPage from './components/BioPage'

type Route = 'clearing' | 'notes' | 'artifacts' | 'bio'
type TransitionPhase = 'idle' | 'fade-out' | 'fade-in'

function parseHash(): Route {
  const h = window.location.hash
  if (h.startsWith('#/notes')) return 'notes'
  if (h.startsWith('#/artifacts')) return 'artifacts'
  if (h.startsWith('#/bio')) return 'bio'
  return 'clearing'
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)
  const [displayRoute, setDisplayRoute] = useState<Route>(route)
  const [phase, setPhase] = useState<TransitionPhase>('idle')

  // Listen for hash changes (back/forward)
  useEffect(() => {
    const onHash = () => {
      const next = parseHash()
      if (next !== route) navigateTo(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [route])

  const navigateTo = useCallback((next: Route) => {
    if (phase !== 'idle') return
    setRoute(next)
    setPhase('fade-out')

    // After fade-out, swap content and fade-in
    setTimeout(() => {
      setDisplayRoute(next)
      setPhase('fade-in')

      setTimeout(() => {
        setPhase('idle')
      }, 400)
    }, 400)
  }, [phase])

  const handleNavigate = useCallback((hashRoute: string) => {
    window.location.hash = hashRoute
    const next = hashRoute === '#/notes' ? 'notes' as Route
      : hashRoute === '#/artifacts' ? 'artifacts' as Route
      : hashRoute === '#/bio' ? 'bio' as Route
      : 'clearing' as Route
    navigateTo(next)
  }, [navigateTo])

  const handleBack = useCallback(() => {
    window.location.hash = '/'
    navigateTo('clearing')
  }, [navigateTo])

  const opacity = phase === 'fade-out' ? 0 : phase === 'fade-in' ? 1 : 1

  return (
    <div className="w-full h-full bg-[#050608]">
      {/* WorldCanvas is ALWAYS mounted to preserve world state across navigation */}
      <div style={{
        visibility: displayRoute === 'clearing' ? 'visible' : 'hidden',
        position: displayRoute === 'clearing' ? 'relative' : 'fixed',
        width: '100%',
        height: '100%',
        opacity: displayRoute === 'clearing' ? opacity : 0,
        transition: 'opacity 400ms ease-in-out',
      }}>
        <WorldCanvas onNavigate={handleNavigate} muffled={displayRoute !== 'clearing'} />
      </div>
      {displayRoute !== 'clearing' && (
        <div
          style={{
            opacity,
            transition: 'opacity 400ms ease-in-out',
            width: '100%',
            height: '100%',
          }}
        >
          {displayRoute === 'notes' && (
            <NotesPage onBack={handleBack} />
          )}
          {displayRoute === 'artifacts' && (
            <ArtifactsPage onBack={handleBack} />
          )}
          {displayRoute === 'bio' && (
            <BioPage onBack={handleBack} />
          )}
        </div>
      )}
    </div>
  )
}
