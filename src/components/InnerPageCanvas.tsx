import { useRef, useEffect } from 'react'
import { getCosmicMood } from '../lib/mood'

type DriftParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  hue: number
  phase: number
  brightness: number
}

export default function InnerPageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    const particles: DriftParticle[] = []

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width = w + 'px'
      canvas!.style.height = h + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function seed() {
      particles.length = 0
      const count = 18
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.1,
          radius: 1 + Math.random() * 1.5,
          hue: 170 + Math.random() * 40,
          phase: Math.random() * Math.PI * 2,
          brightness: 0.15 + Math.random() * 0.15,
        })
      }
    }

    resize()
    seed()
    window.addEventListener('resize', resize)

    let time = 0

    function frame() {
      time += 0.016
      const mood = getCosmicMood()

      // Background gradient
      const grad = ctx!.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, '#050710')
      grad.addColorStop(0.5, '#060810')
      grad.addColorStop(1, '#040608')
      ctx!.fillStyle = grad
      ctx!.fillRect(0, 0, w, h)

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx + Math.sin(time * 0.2 + p.phase) * 0.08 * mood.driftSpeed
        p.y += p.vy + Math.cos(time * 0.15 + p.phase * 1.3) * 0.06 * mood.driftSpeed

        // Wrap
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        const alpha = p.brightness * (0.5 + Math.sin(time * 0.4 + p.phase) * 0.2)

        if (alpha < 0.03) continue

        // Soft halo
        const haloR = p.radius * 6
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, haloR, 0, Math.PI * 2)
        ctx!.fillStyle = `hsla(${p.hue}, 50%, 50%, ${alpha * 0.04})`
        ctx!.fill()

        // Core dot
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `hsla(${p.hue}, 60%, 80%, ${alpha * 0.6})`
        ctx!.fill()
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
