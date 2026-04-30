import { useRef, useEffect, useCallback } from 'react'
import type { WorldState } from '../lib/simulation'
import { createWorld, updateWorld, addRipple } from '../lib/simulation'

export default function WorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<WorldState | null>(null)
  const lastMouseRef = useRef({ x: 0, y: 0, time: 0 })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const world = worldRef.current
    if (!world) return

    const now = performance.now()
    const dx = e.clientX - lastMouseRef.current.x
    const dy = e.clientY - lastMouseRef.current.y
    const elapsed = now - lastMouseRef.current.time
    if (elapsed > 0) {
      world.mouseSpeed = Math.sqrt(dx * dx + dy * dy) / Math.max(elapsed, 1) * 16
    }

    lastMouseRef.current.x = e.clientX
    lastMouseRef.current.y = e.clientY
    lastMouseRef.current.time = now

    const dpr = window.devicePixelRatio || 1
    world.player.targetX = e.clientX * dpr
    world.player.targetY = e.clientY * dpr
  }, [])

  const handleClick = useCallback((e: MouseEvent) => {
    const world = worldRef.current
    if (!world) return
    const dpr = window.devicePixelRatio || 1
    addRipple(world, e.clientX * dpr, e.clientY * dpr)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let alive = true

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width = window.innerWidth * dpr
      canvas!.height = window.innerHeight * dpr
      canvas!.style.width = window.innerWidth + 'px'
      canvas!.style.height = window.innerHeight + 'px'

      worldRef.current = createWorld(canvas!.width, canvas!.height)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)

    let lastTime = 0

    function render(timestamp: number) {
      if (!alive) return

      const dt = lastTime === 0 ? 0.016 : Math.min((timestamp - lastTime) / 1000, 0.05)
      lastTime = timestamp

      const world = worldRef.current
      if (world) {
        updateWorld(world, dt, canvas!.width, canvas!.height)
        draw(ctx!, world, canvas!.width, canvas!.height)
      }

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    return () => {
      alive = false
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
    }
  }, [handleMouseMove, handleClick])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ cursor: 'none' }}
    />
  )
}

// ---- Drawing ----

function draw(ctx: CanvasRenderingContext2D, world: WorldState, w: number, h: number) {
  drawBackground(ctx, w, h, world)
  drawFog(ctx, w, h, world)
  drawParticles(ctx, world)
  drawGrass(ctx, world, h)
  drawRipples(ctx, world, world.scale)
  drawPlayerTrail(ctx, world.player, world.scale)
  drawPlayer(ctx, world.player, world.time, world.scale)
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  const { mood, karma } = world
  const bShift = karma.beauty * 12
  const cShift = karma.corruption * -8

  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, `hsl(${225 + bShift + cShift}, ${25 + mood.saturation * 15}%, ${4 + mood.brightness * 4}%)`)
  grad.addColorStop(0.35, `hsl(${215 + bShift}, ${20 + mood.saturation * 10}%, ${5 + mood.brightness * 3}%)`)
  grad.addColorStop(0.6, `hsl(${175 + bShift + cShift}, ${22 + mood.saturation * 12}%, ${5 + mood.brightness * 3}%)`)
  grad.addColorStop(0.85, `hsl(${150 + bShift}, ${28 + mood.saturation * 10}%, ${4 + mood.brightness * 3}%)`)
  grad.addColorStop(1, `hsl(${135 + bShift}, ${30 + mood.saturation * 8}%, ${3 + mood.brightness * 2}%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

function drawFog(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  const { mood, time } = world
  const fogAlpha = 0.04 + mood.fogAmount * 0.06

  // Primary horizon fog — single gradient instead of multiple layers
  const horizonY = h * 0.58
  const fogGrad = ctx.createRadialGradient(
    w / 2 + Math.sin(time * 0.08) * w * 0.08, horizonY, 0,
    w / 2, horizonY, w * 0.8
  )
  fogGrad.addColorStop(0, `hsla(175, 25%, 25%, ${fogAlpha * 2.5})`)
  fogGrad.addColorStop(0.3, `hsla(190, 20%, 18%, ${fogAlpha * 1.5})`)
  fogGrad.addColorStop(0.7, `hsla(200, 15%, 12%, ${fogAlpha * 0.5})`)
  fogGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = fogGrad
  ctx.fillRect(0, 0, w, h)

  // Ground glow — single linear gradient
  const groundGlow = ctx.createLinearGradient(0, h * 0.7, 0, h)
  groundGlow.addColorStop(0, 'transparent')
  groundGlow.addColorStop(0.5, `hsla(160, 30%, 10%, ${fogAlpha * 1.5})`)
  groundGlow.addColorStop(1, `hsla(150, 25%, 8%, ${fogAlpha * 2})`)
  ctx.fillStyle = groundGlow
  ctx.fillRect(0, 0, w, h)

  // Reduced to 2 mist patches instead of 5
  for (let i = 0; i < 2; i++) {
    const mx = w * (0.25 + i * 0.5) + Math.sin(time * 0.04 + i * 1.7) * w * 0.12
    const my = h * (0.4 + i * 0.1) + Math.cos(time * 0.025 + i * 2.3) * h * 0.05
    const mr = w * 0.25

    const mist = ctx.createRadialGradient(mx, my, 0, mx, my, mr)
    mist.addColorStop(0, `hsla(${165 + i * 20}, 20%, 22%, ${fogAlpha * 1.0})`)
    mist.addColorStop(0.6, `hsla(${175 + i * 15}, 15%, 15%, ${fogAlpha * 0.3})`)
    mist.addColorStop(1, 'transparent')
    ctx.fillStyle = mist
    ctx.fillRect(0, 0, w, h)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, world: WorldState) {
  // Draw all particles in a single pass — no layering needed, just draw by index
  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i]
    const r = p.radius
    const alpha = p.brightness * 0.6

    if (alpha < 0.05) continue

    // Single simple glow — one radial gradient instead of multi-layer halo
    const haloR = r * 5
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR)
    glow.addColorStop(0, `hsla(${p.hue}, 70%, 75%, ${alpha * 0.4})`)
    glow.addColorStop(0.4, `hsla(${p.hue}, 55%, 50%, ${alpha * 0.1})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(p.x - haloR, p.y - haloR, haloR * 2, haloR * 2)

    // Bright core dot
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, 70%, 85%, ${alpha * 0.8})`
    ctx.fill()
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, world: WorldState, h: number) {
  const { grass, mood, karma, time } = world
  const s = world.scale

  const baseY = h
  const baseHue = 135 + mood.hueBias * 0.05
  const baseSat = 35 + karma.beauty * 25
  const baseLit = 18 + karma.beauty * 14

  ctx.lineCap = 'round'

  // Draw blades without sorting (sorting every frame is expensive)
  for (let i = 0; i < grass.length; i++) {
    const blade = grass[i]
    const bendOffset = blade.bend * blade.baseHeight * 0.5
    const tipX = blade.x + bendOffset
    const tipY = baseY - blade.baseHeight
    const cpX = blade.x + bendOffset * 0.4
    const cpY = baseY - blade.baseHeight * 0.5

    const strokeW = 1.5 * s + blade.baseHeight * 0.008

    // Simplified luminous tip glow — single alpha circle instead of radial gradient
    if (blade.luminous) {
      const glowPulse = 0.4 + Math.sin(time * 1.8 + blade.phase) * 0.3
      const glowSize = (14 + glowPulse * 8) * s
      ctx.beginPath()
      ctx.arc(tipX, tipY, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${blade.hue}, 70%, 55%, ${0.06 + glowPulse * 0.08})`
      ctx.fill()
    }

    // Blade stroke — use simple color instead of gradient for most blades
    ctx.beginPath()
    ctx.moveTo(blade.x, baseY)
    ctx.quadraticCurveTo(cpX, cpY, tipX, tipY)

    if (blade.luminous) {
      const glowPulse = 0.4 + Math.sin(time * 1.8 + blade.phase) * 0.3
      // Gradient only for luminous blades (fewer of them)
      const grad = ctx.createLinearGradient(blade.x, baseY, tipX, tipY)
      grad.addColorStop(0, `hsl(${baseHue}, ${baseSat * 0.6}%, ${baseLit * 0.4}%)`)
      grad.addColorStop(0.7, `hsl(${blade.hue}, 60%, ${20 + glowPulse * 15}%)`)
      grad.addColorStop(1, `hsl(${blade.hue}, 80%, ${30 + glowPulse * 25}%)`)
      ctx.strokeStyle = grad
    } else {
      // Simple solid color for non-luminous blades — huge perf win
      const lit = baseLit * 0.5 + (blade.baseHeight / (300 * s)) * baseLit * 0.5
      ctx.strokeStyle = `hsl(${baseHue + 8}, ${baseSat * 0.7}%, ${lit}%)`
    }

    ctx.lineWidth = Math.max(strokeW, 2 * s)
    ctx.stroke()
  }
}

function drawRipples(ctx: CanvasRenderingContext2D, world: WorldState, scale: number) {
  for (let i = 0; i < world.ripples.length; i++) {
    const r = world.ripples[i]
    if (r.alpha < 0.02) continue

    const hue = 175 + world.karma.beauty * 25

    // Single ring instead of two
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${hue}, 65%, 60%, ${r.alpha * 0.7})`
    ctx.lineWidth = 2 * scale
    ctx.stroke()

    // Simple fill glow — only if visible enough
    if (r.alpha > 0.1) {
      const glow = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius)
      glow.addColorStop(0, `hsla(${hue}, 60%, 60%, ${r.alpha * 0.1})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawPlayerTrail(ctx: CanvasRenderingContext2D, player: WorldState['player'], scale: number) {
  if (player.trail.length < 2) return

  // Draw trail as a single path instead of individual segments
  ctx.beginPath()
  ctx.moveTo(player.trail[0].x, player.trail[0].y)
  for (let i = 1; i < player.trail.length; i++) {
    const t = player.trail[i]
    if (t.alpha < 0.02) break
    ctx.lineTo(t.x, t.y)
  }
  ctx.strokeStyle = `hsla(180, 65%, 65%, 0.15)`
  ctx.lineWidth = 2 * scale
  ctx.stroke()
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: WorldState['player'], time: number, scale: number) {
  const { x, y, aura, energy } = player
  const pulse = Math.sin(time * 2.5) * 0.12 + 1

  // Single aura glow instead of two layered ones
  const outerR = aura * pulse * 2.5
  const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, outerR)
  outerGlow.addColorStop(0, `hsla(182, 80%, 72%, ${0.18 * energy})`)
  outerGlow.addColorStop(0.3, `hsla(185, 65%, 55%, ${0.07 * energy})`)
  outerGlow.addColorStop(0.7, `hsla(190, 40%, 40%, ${0.02 * energy})`)
  outerGlow.addColorStop(1, 'transparent')
  ctx.fillStyle = outerGlow
  ctx.beginPath()
  ctx.arc(x, y, outerR, 0, Math.PI * 2)
  ctx.fill()

  // Core blob — reduced wobble steps from 32 to 16
  const coreR = (8 + energy * 5) * scale
  ctx.beginPath()
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const wobble = 1
      + Math.sin(a * 3 + time * 3.2) * 0.1
      + Math.cos(a * 5 + time * 2.1) * 0.07
    const px = x + Math.cos(a) * coreR * wobble * pulse
    const py = y + Math.sin(a) * coreR * wobble * pulse
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = `hsla(180, 85%, 82%, ${0.65 + energy * 0.35})`
  ctx.fill()

  // Inner bright center
  const innerR = coreR * 0.5
  const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, innerR)
  innerGlow.addColorStop(0, `hsla(175, 95%, 95%, ${0.9 * energy})`)
  innerGlow.addColorStop(0.5, `hsla(180, 90%, 85%, ${0.5 * energy})`)
  innerGlow.addColorStop(1, 'transparent')
  ctx.fillStyle = innerGlow
  ctx.beginPath()
  ctx.arc(x, y, innerR, 0, Math.PI * 2)
  ctx.fill()
}
