import { useState, useEffect, useCallback, useRef } from 'react'
import WorldCanvas from './components/WorldCanvas'
import NotesPage from './components/NotesPage'
import ArtifactsPage from './components/ArtifactsPage'
import BioPage from './components/BioPage'

type Route = 'clearing' | 'notes' | 'artifacts' | 'bio'
type TransitionPhase = 'idle' | 'bloom' | 'fade-out' | 'blackout' | 'fade-in'

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
  const pendingRoute = useRef<Route | null>(null)

  // Update tab title for inner pages
  useEffect(() => {
    if (displayRoute === 'notes') document.title = '\u2728 fragments'
    else if (displayRoute === 'artifacts') document.title = '\u2728 relics'
    else if (displayRoute === 'bio') document.title = '\u2728 rajat'
    else document.title = '\u2728'
  }, [displayRoute])

  // Listen for hash changes (back/forward)
  useEffect(() => {
    const onHash = () => {
      const next = parseHash()
      if (next !== route) navigateTo(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [route])

  const startTransition = useCallback((next: Route) => {
    setRoute(next)
    if (next !== 'clearing') {
      setPhase('bloom')
      setTimeout(() => {
        setPhase('fade-out')
        setTimeout(() => {
          setPhase('blackout')
          setTimeout(() => {
            setDisplayRoute(next)
            setPhase('fade-in')
            setTimeout(() => setPhase('idle'), 500)
          }, 200)
        }, 400)
      }, 200)
    } else {
      setPhase('fade-out')
      setTimeout(() => {
        setPhase('blackout')
        setTimeout(() => {
          setDisplayRoute(next)
          setPhase('fade-in')
          setTimeout(() => setPhase('idle'), 500)
        }, 300)
      }, 400)
    }
  }, [])

  // Process queued navigation when transition finishes
  useEffect(() => {
    if (phase === 'idle' && pendingRoute.current !== null) {
      const queued = pendingRoute.current
      pendingRoute.current = null
      startTransition(queued)
    }
  }, [phase, startTransition])

  const navigateTo = useCallback((next: Route) => {
    if (phase !== 'idle') {
      pendingRoute.current = next
      return
    }
    startTransition(next)
  }, [phase, startTransition])

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

  const canvasOpacity = phase === 'fade-out' || phase === 'blackout' ? 0 : 1
  const pageOpacity = phase === 'fade-out' || phase === 'blackout' ? 0 : phase === 'fade-in' ? 1 : 1
  const bloomActive = phase === 'bloom'

  return (
    <div className="w-full h-full bg-[#050608]">
      {/* WorldCanvas is ALWAYS mounted to preserve world state across navigation */}
      <div style={{
        visibility: displayRoute === 'clearing' ? 'visible' : 'hidden',
        position: displayRoute === 'clearing' ? 'relative' : 'fixed',
        width: '100%',
        height: '100%',
        opacity: displayRoute === 'clearing' ? canvasOpacity : 0,
        transition: `opacity ${phase === 'fade-out' ? 400 : 500}ms ease-in-out`,
      }}>
        <WorldCanvas onNavigate={handleNavigate} muffled={displayRoute !== 'clearing'} />
        {bloomActive && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255, 255, 255, 0.15)',
            pointerEvents: 'none',
            animation: 'bloom-flash 200ms ease-out forwards',
          }} />
        )}
      </div>
      {displayRoute !== 'clearing' && (
        <div
          style={{
            opacity: pageOpacity,
            transition: 'opacity 500ms ease-in-out',
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
