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
  drawParticlesForLayer(ctx, world, 0)
  drawParticlesForLayer(ctx, world, 1)
  drawGrass(ctx, world, h)
  drawParticlesForLayer(ctx, world, 2)
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

  // Subtle grain/noise — reduced from 200 to 80, using for loop
  for (let i = 0; i < 80; i++) {
    const nx = ((i * 7919 + world.time * 0.1) % 1) * w
    const ny = ((i * 6271 + world.time * 0.07) % 1) * h
    ctx.fillStyle = `hsla(200, 10%, 30%, ${0.015 + Math.sin(i + world.time * 0.5) * 0.01})`
    ctx.fillRect(nx, ny, 2, 2)
  }
}

function drawFog(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  const { mood, time } = world
  const fogAlpha = 0.04 + mood.fogAmount * 0.06

  // Primary horizon fog
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

  // Ground glow
  const groundGlow = ctx.createLinearGradient(0, h * 0.7, 0, h)
  groundGlow.addColorStop(0, 'transparent')
  groundGlow.addColorStop(0.5, `hsla(160, 30%, 10%, ${fogAlpha * 1.5})`)
  groundGlow.addColorStop(1, `hsla(150, 25%, 8%, ${fogAlpha * 2})`)
  ctx.fillStyle = groundGlow
  ctx.fillRect(0, 0, w, h)

  // Drifting mist patches — reduced from 5 to 3
  for (let i = 0; i < 3; i++) {
    const mx = w * (0.15 + i * 0.3) + Math.sin(time * 0.04 + i * 1.7) * w * 0.12
    const my = h * (0.35 + i * 0.1) + Math.cos(time * 0.025 + i * 2.3) * h * 0.05
    const mr = w * 0.2 + Math.sin(time * 0.03 + i) * w * 0.04

    const mist = ctx.createRadialGradient(mx, my, 0, mx, my, mr)
    mist.addColorStop(0, `hsla(${165 + i * 15}, 20%, 22%, ${fogAlpha * 1.2})`)
    mist.addColorStop(0.6, `hsla(${175 + i * 12}, 15%, 15%, ${fogAlpha * 0.4})`)
    mist.addColorStop(1, 'transparent')
    ctx.fillStyle = mist
    ctx.fillRect(0, 0, w, h)
  }
}

function drawParticlesForLayer(ctx: CanvasRenderingContext2D, world: WorldState, layer: number) {
  const layerScale = layer === 0 ? 0.6 : layer === 1 ? 1.0 : 1.5
  const alphaBase = layer === 0 ? 0.4 : layer === 1 ? 0.6 : 0.8

  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i]
    if (p.layer !== layer) continue

    const r = p.radius * layerScale
    const alpha = p.brightness * alphaBase

    if (alpha < 0.05) continue

    // Glow halo — simplified to 3 stops (was 4)
    const haloR = r * 6
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR)
    glow.addColorStop(0, `hsla(${p.hue}, 70%, 75%, ${alpha * 0.45})`)
    glow.addColorStop(0.3, `hsla(${p.hue}, 55%, 50%, ${alpha * 0.12})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(p.x - haloR, p.y - haloR, haloR * 2, haloR * 2)

    // Bright core
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 0.8, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, 70%, 85%, ${alpha * 0.9})`
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

  // Grass is pre-sorted at creation time — no per-frame sort needed
  ctx.lineCap = 'round'

  for (let i = 0; i < grass.length; i++) {
    const blade = grass[i]
    const bendOffset = blade.bend * blade.baseHeight * 0.5
    const tipX = blade.x + bendOffset
    const tipY = baseY - blade.baseHeight
    const cpX = blade.x + bendOffset * 0.4
    const cpY = baseY - blade.baseHeight * 0.5

    const strokeW = 1.5 * s + blade.baseHeight * 0.008

    if (blade.luminous) {
      const glowPulse = 0.4 + Math.sin(time * 1.8 + blade.phase) * 0.3 + Math.sin(time * 0.7 + blade.phase * 2) * 0.2

      // Luminous tip glow — simple alpha circle instead of radial gradient
      const glowSize = (18 + glowPulse * 12) * s
      ctx.beginPath()
      ctx.arc(tipX, tipY, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${blade.hue}, 75%, 60%, ${0.08 + glowPulse * 0.12})`
      ctx.fill()

      // Luminous blade stroke — gradient only for luminous blades (~15% of total)
      ctx.beginPath()
      ctx.moveTo(blade.x, baseY)
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY)
      const grad = ctx.createLinearGradient(blade.x, baseY, tipX, tipY)
      grad.addColorStop(0, `hsl(${baseHue}, ${baseSat * 0.6}%, ${baseLit * 0.4}%)`)
      grad.addColorStop(0.5, `hsl(${baseHue + 10}, ${baseSat}%, ${baseLit * 0.7}%)`)
      grad.addColorStop(0.75, `hsl(${blade.hue}, 60%, ${20 + glowPulse * 15}%)`)
      grad.addColorStop(1, `hsl(${blade.hue}, 80%, ${30 + glowPulse * 30}%)`)
      ctx.strokeStyle = grad
    } else {
      // Non-luminous blade — solid color instead of per-blade gradient
      // Height-based lightness variation preserves the depth illusion
      ctx.beginPath()
      ctx.moveTo(blade.x, baseY)
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY)
      const heightFrac = blade.baseHeight / (320 * s)
      const lit = baseLit * (0.35 + heightFrac * 0.65)
      const sat = baseSat * (0.5 + heightFrac * 0.5)
      ctx.strokeStyle = `hsl(${baseHue + heightFrac * 15}, ${sat}%, ${lit}%)`
    }

    ctx.lineWidth = Math.max(strokeW, 2 * s)
    ctx.stroke()
  }
}

function drawRipples(ctx: CanvasRenderingContext2D, world: WorldState, scale: number) {
  const hue = 175 + world.karma.beauty * 25

  for (let i = 0; i < world.ripples.length; i++) {
    const r = world.ripples[i]
    if (r.alpha < 0.02) continue

    // Outer ring
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${hue}, 65%, 60%, ${r.alpha * 0.8})`
    ctx.lineWidth = 2.5 * scale
    ctx.stroke()

    // Inner softer ring
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${hue}, 55%, 55%, ${r.alpha * 0.4})`
    ctx.lineWidth = 1.5 * scale
    ctx.stroke()

    // Glow fill — only when clearly visible
    if (r.alpha > 0.08) {
      const glow = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius)
      glow.addColorStop(0, `hsla(${hue}, 60%, 60%, ${r.alpha * 0.12})`)
      glow.addColorStop(0.5, `hsla(${hue}, 50%, 45%, ${r.alpha * 0.05})`)
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

  // Draw trail segments with per-segment alpha fading
  for (let i = 1; i < player.trail.length; i++) {
    const t = player.trail[i]
    const prev = player.trail[i - 1]
    if (t.alpha < 0.02) continue

    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(t.x, t.y)
    ctx.strokeStyle = `hsla(180, 65%, 65%, ${t.alpha * 0.4})`
    ctx.lineWidth = 3 * t.alpha * scale
    ctx.stroke()
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: WorldState['player'], time: number, scale: number) {
  const { x, y, aura, energy } = player
  const pulse = Math.sin(time * 2.5) * 0.12 + 1
  const breathe = Math.sin(time * 1.2) * 0.08 + 1

  // Outer aura — wide, soft presence
  const outerR = aura * pulse * 3.5
  const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, outerR)
  outerGlow.addColorStop(0, `hsla(185, 75%, 70%, ${0.1 * energy})`)
  outerGlow.addColorStop(0.3, `hsla(185, 60%, 55%, ${0.04 * energy})`)
  outerGlow.addColorStop(1, 'transparent')
  ctx.fillStyle = outerGlow
  ctx.beginPath()
  ctx.arc(x, y, outerR, 0, Math.PI * 2)
  ctx.fill()

  // Mid aura — tighter glow ring
  const midR = aura * breathe * 1.8
  const midGlow = ctx.createRadialGradient(x, y, 0, x, y, midR)
  midGlow.addColorStop(0, `hsla(180, 85%, 75%, ${0.3 * energy})`)
  midGlow.addColorStop(0.4, `hsla(180, 70%, 55%, ${0.12 * energy})`)
  midGlow.addColorStop(1, 'transparent')
  ctx.fillStyle = midGlow
  ctx.beginPath()
  ctx.arc(x, y, midR, 0, Math.PI * 2)
  ctx.fill()

  // Core blob — organic wobble (20 steps, was 32)
  const coreR = (8 + energy * 5) * scale
  ctx.beginPath()
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const wobble = 1
      + Math.sin(a * 3 + time * 3.2) * 0.1
      + Math.cos(a * 5 + time * 2.1) * 0.07
      + Math.sin(a * 7 + time * 1.5) * 0.04
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
