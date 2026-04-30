import { useRef, useEffect, useCallback } from 'react'
import type { WorldState, Entity } from '../lib/simulation'
import { createWorld, updateWorld, addRipple, addFlash, findNavNodeAt, handleWorldClick, ENTITY_COLORS } from '../lib/simulation'
import { AudioEngine } from './AudioEngine'

export default function WorldCanvas({ onNavigate, muffled }: { onNavigate?: (route: string) => void; muffled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<WorldState | null>(null)
  const lastMouseRef = useRef({ x: 0, y: 0, time: 0 })
  const audioRef = useRef<AudioEngine | null>(null)
  const clickedThisFrame = useRef(false)
  const muteHover = useRef(false)
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    const world = worldRef.current
    if (!world) return

    // Start audio on first interaction
    if (audioRef.current && !audioRef.current.isMuted()) {
      audioRef.current.start()
    }

    const now = performance.now()
    const dx = clientX - lastMouseRef.current.x
    const dy = clientY - lastMouseRef.current.y
    const elapsed = now - lastMouseRef.current.time
    if (elapsed > 0) {
      world.mouseSpeed = Math.sqrt(dx * dx + dy * dy) / Math.max(elapsed, 1) * 16
    }

    lastMouseRef.current.x = clientX
    lastMouseRef.current.y = clientY
    lastMouseRef.current.time = now

    const dpr = window.devicePixelRatio || 1
    world.player.targetX = clientX * dpr
    world.player.targetY = clientY * dpr

    // Check mute button hover
    const canvas = canvasRef.current
    if (canvas) {
      const bx = canvas.width / dpr - 36
      const by = canvas.height / dpr - 36
      const md = Math.sqrt((clientX - bx) ** 2 + (clientY - by) ** 2)
      muteHover.current = md < 20
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY)
  }, [handlePointerMove])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault()
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [handlePointerMove])

  const handlePointerClick = useCallback((clientX: number, clientY: number) => {
    const world = worldRef.current
    if (!world) return

    // Start audio on first click
    if (audioRef.current) {
      audioRef.current.start()
    }

    const dpr = window.devicePixelRatio || 1

    // Check mute button click
    const canvas = canvasRef.current
    if (canvas) {
      const bx = canvas.width / dpr - 36
      const by = canvas.height / dpr - 36
      const md = Math.sqrt((clientX - bx) ** 2 + (clientY - by) ** 2)
      if (md < 20) {
        audioRef.current?.toggle()
        return
      }
    }

    const cx = clientX * dpr
    const cy = clientY * dpr

    // Check nav node click
    const navNode = findNavNodeAt(world, cx, cy)
    if (navNode && onNavigateRef.current) {
      onNavigateRef.current(navNode.route)
      return
    }

    // Entity interaction click
    const result = handleWorldClick(world, cx, cy)
    clickedThisFrame.current = true

    switch (result.type) {
      case 'ripple':
        addRipple(world, cx, cy)
        break
      case 'fragile_nourish':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 220, 180, 80)  // warm amber
        break
      case 'cooperator_exchange':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 80, 230, 190)  // bright cyan-green
        break
      case 'corruptor_cleanse_success':
        addRipple(world, cx, cy)
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 200, 240, 255, 100)  // white-cyan bloom
        break
      case 'corruptor_cleanse_fail':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 100, 130, 70)  // sickly green
        break
      case 'defector_risk':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 220, 100, 60)  // red-amber
        break
      case 'ember_revive':
        addRipple(world, cx, cy)
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 255, 200, 100, 90)  // warm bloom
        break
    }
  }, [])

  const handleClick = useCallback((e: MouseEvent) => {
    handlePointerClick(e.clientX, e.clientY)
  }, [handlePointerClick])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault()
    if (e.touches.length > 0) {
      const touch = e.touches[0]
      handlePointerMove(touch.clientX, touch.clientY)
      handlePointerClick(touch.clientX, touch.clientY)
    }
  }, [handlePointerMove, handlePointerClick])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let alive = true

    // Initialize audio engine
    if (!audioRef.current) {
      audioRef.current = new AudioEngine()
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width = window.innerWidth * dpr
      canvas!.height = window.innerHeight * dpr
      canvas!.style.width = window.innerWidth + 'px'
      canvas!.style.height = window.innerHeight + 'px'

      if (!worldRef.current) {
        // First creation only
        worldRef.current = createWorld(canvas!.width, canvas!.height)
      } else {
        // On resize, just update scale — don't recreate world
        worldRef.current.scale = canvas!.height / 800
      }
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })

    let lastTime = 0

    function render(timestamp: number) {
      if (!alive) return

      const dt = lastTime === 0 ? 0.016 : Math.min((timestamp - lastTime) / 1000, 0.05)
      lastTime = timestamp

      const world = worldRef.current
      if (world) {
        updateWorld(world, dt, canvas!.width, canvas!.height)

        // Update audio engine
        if (audioRef.current) {
          audioRef.current.update({
            mood: world.mood,
            beauty: world.karma.beauty,
            trust: world.karma.trust,
            hostility: world.karma.hostility,
            corruption: world.karma.corruption,
            playerEnergy: world.player.energy,
            playerAlive: world.player.alive,
            mouseSpeed: world.mouseSmoothed,
            isHovering: false,
            clickEvent: clickedThisFrame.current,
            cleansing: false,
          })
          clickedThisFrame.current = false
        }

        draw(ctx!, world, canvas!.width, canvas!.height)
        drawMuteGlyph(ctx!, canvas!.width, canvas!.height, audioRef.current?.isMuted() ?? false, muteHover.current)
      }

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    return () => {
      alive = false
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchstart', handleTouchStart)
      if (audioRef.current) {
        audioRef.current.dispose()
        audioRef.current = null
      }
    }
  }, [handleMouseMove, handleClick, handleTouchMove, handleTouchStart])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setMuffled(!!muffled)
    }
  }, [muffled])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ cursor: 'none', touchAction: 'none' }}
    />
  )
}

// ---- Drawing ----

function draw(ctx: CanvasRenderingContext2D, world: WorldState, w: number, h: number) {
  const isDead = !world.player.alive

  drawBackground(ctx, w, h, world)
  drawFog(ctx, w, h, world)
  drawParticlesForLayer(ctx, world, 0)
  drawParticlesForLayer(ctx, world, 1)
  drawGrass(ctx, world, h)
  drawEntities(ctx, world)
  drawParticlesForLayer(ctx, world, 2)
  drawNavNodes(ctx, world)
  drawRipples(ctx, world, world.scale)
  drawFlashes(ctx, world, world.scale)

  if (isDead) {
    // Desaturation overlay when dead
    ctx.fillStyle = 'rgba(10, 12, 15, 0.35)'
    ctx.fillRect(0, 0, w, h)
    drawEmber(ctx, world)
  } else {
    drawPlayerTrail(ctx, world.player, world.scale)
    drawPlayer(ctx, world.player, world.time, world.scale)
  }

  drawKarmaOverlay(ctx, w, h, world)
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  const { mood, karma } = world
  const bShift = karma.beauty * 12
  const cShift = karma.corruption * -8

  // Layered horizontal bands instead of a linear gradient
  const bands = [
    { y: 0,        frac: 0.35, hue: 225 + bShift + cShift, sat: 25 + mood.saturation * 15, lit: 4 + mood.brightness * 4 },
    { y: h * 0.35, frac: 0.25, hue: 215 + bShift,          sat: 20 + mood.saturation * 10, lit: 5 + mood.brightness * 3 },
    { y: h * 0.6,  frac: 0.25, hue: 175 + bShift + cShift, sat: 22 + mood.saturation * 12, lit: 5 + mood.brightness * 3 },
    { y: h * 0.85, frac: 0.15, hue: 150 + bShift,          sat: 28 + mood.saturation * 10, lit: 4 + mood.brightness * 3 },
  ]
  // Fill bottom color first as base
  ctx.fillStyle = `hsl(${135 + bShift}, ${30 + mood.saturation * 8}%, ${3 + mood.brightness * 2}%)`
  ctx.fillRect(0, 0, w, h)
  // Overlay bands top-down
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]
    ctx.fillStyle = `hsl(${b.hue}, ${b.sat}%, ${b.lit}%)`
    ctx.fillRect(0, b.y, w, h * b.frac + 2)
  }

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

  // Horizon fog — simple semi-transparent rect at horizon band
  const horizonY = h * 0.45
  const horizonH = h * 0.3
  ctx.fillStyle = `hsla(175, 25%, 25%, ${fogAlpha * 1.8})`
  ctx.fillRect(0, horizonY, w, horizonH)
  ctx.fillStyle = `hsla(190, 20%, 18%, ${fogAlpha * 0.8})`
  ctx.fillRect(0, horizonY - h * 0.1, w, horizonH + h * 0.2)

  // Ground glow — simple rect fills
  ctx.fillStyle = `hsla(160, 30%, 10%, ${fogAlpha * 1.2})`
  ctx.fillRect(0, h * 0.8, w, h * 0.2)
  ctx.fillStyle = `hsla(150, 25%, 8%, ${fogAlpha * 1.5})`
  ctx.fillRect(0, h * 0.9, w, h * 0.1)

  // Drifting mist patches — simple alpha rects, 2 patches
  for (let i = 0; i < 2; i++) {
    const mx = w * (0.1 + i * 0.4) + Math.sin(time * 0.04 + i * 1.7) * w * 0.12
    const my = h * (0.3 + i * 0.15) + Math.cos(time * 0.025 + i * 2.3) * h * 0.05
    const mw = w * 0.4
    const mh = h * 0.15
    ctx.fillStyle = `hsla(${165 + i * 15}, 20%, 22%, ${fogAlpha * 0.7})`
    ctx.fillRect(mx - mw / 2, my - mh / 2, mw, mh)
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

    const haloR = r * 5
    ctx.beginPath()
    ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, 60%, 55%, ${alpha * 0.06})`
    ctx.fill()

    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, 70%, 85%, ${alpha * 0.9})`
    ctx.fill()
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, world: WorldState, _h: number) {
  const { mood, karma, time } = world
  const s = world.scale

  const baseHue = 135 + mood.hueBias * 0.05
  const baseSat = 35 + karma.beauty * 25
  const baseLit = 18 + karma.beauty * 14

  ctx.lineCap = 'round'

  const h = world.scale * 800
  for (let i = 0; i < world.grass.length; i++) {
    const blade = world.grass[i]
    const baseY = h
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

      // Luminous blade stroke — solid color with luminous hue (no gradient)
      ctx.beginPath()
      ctx.moveTo(blade.x, baseY)
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY)
      ctx.strokeStyle = `hsl(${blade.hue}, 70%, ${22 + glowPulse * 20}%)`
    } else {
      // Non-luminous blade — solid color instead of per-blade gradient
      // Height-based lightness variation preserves the depth illusion
      ctx.beginPath()
      ctx.moveTo(blade.x, baseY)
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY)
      const heightFrac = blade.baseHeight / (320 * s)
      const lit = baseLit * (0.5 + heightFrac * 0.5)
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

    // Glow fill — simple alpha circle
    if (r.alpha > 0.08) {
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue}, 55%, 50%, ${r.alpha * 0.07})`
      ctx.fill()
    }
  }
}

function drawFlashes(ctx: CanvasRenderingContext2D, world: WorldState, scale: number) {
  for (let i = 0; i < world.flashes.length; i++) {
    const f = world.flashes[i]
    if (f.alpha < 0.03) continue

    // Outer glow
    ctx.beginPath()
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${f.r}, ${f.g}, ${f.b}, ${f.alpha * 0.15})`
    ctx.fill()

    // Bright ring
    ctx.beginPath()
    ctx.arc(f.x, f.y, f.radius * 0.6, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${f.r}, ${f.g}, ${f.b}, ${f.alpha * 0.6})`
    ctx.lineWidth = 2.5 * scale
    ctx.stroke()

    // Core burst
    ctx.beginPath()
    ctx.arc(f.x, f.y, f.radius * 0.2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${Math.min(255, f.r + 50)}, ${Math.min(255, f.g + 50)}, ${Math.min(255, f.b + 50)}, ${f.alpha * 0.8})`
    ctx.fill()
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
  // Fade player as energy drops toward death
  const energyAlpha = 0.3 + energy * 0.7

  // Outer aura — simple alpha circle
  const outerR = aura * pulse * 3.5
  ctx.beginPath()
  ctx.arc(x, y, outerR, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(185, 75%, 70%, ${0.06 * energy * energyAlpha})`
  ctx.fill()

  // Mid aura — simple alpha circle
  const midR = aura * breathe * 1.8
  ctx.beginPath()
  ctx.arc(x, y, midR, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(180, 85%, 75%, ${0.15 * energy * energyAlpha})`
  ctx.fill()

  // Core blob — organic wobble (20 steps)
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
  ctx.fillStyle = `hsla(180, 85%, 82%, ${(0.65 + energy * 0.35) * energyAlpha})`
  ctx.fill()

  // Inner bright center — simple alpha circle
  const innerR = coreR * 0.5
  ctx.beginPath()
  ctx.arc(x, y, innerR, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(175, 95%, 95%, ${0.8 * energy * energyAlpha})`
  ctx.fill()
}

// ---- Nav Nodes ----

function drawNavNodes(ctx: CanvasRenderingContext2D, world: WorldState) {
  const { navNodes, time, scale: s } = world
  for (let i = 0; i < navNodes.length; i++) {
    const n = navNodes[i]
    if (n.revealed < 0.05) continue
    const a = n.revealed < 0.3 ? n.revealed / 0.3 * 0.15 : n.revealed < 0.7 ? 0.15 + (n.revealed - 0.3) / 0.4 * 0.35 : 0.5 + (n.revealed - 0.7) / 0.3 * 0.5
    const p = n.revealed >= 0.95 ? 1 + Math.sin(time * 2.5 + n.phase) * 0.15 : 1
    if (n.kind === 'note') { _drawNote(ctx, n.x, n.y, n.revealed, a, p, time, n.phase, s) }
    else if (n.kind === 'artifact') { _drawArtifact(ctx, n.x, n.y, n.revealed, a, p, time, n.phase, s) }
    else { _drawBio(ctx, n.x, n.y, n.revealed, a, p, s) }
  }
}
function _drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, rev: number, al: number, pu: number, t: number, ph: number, s: number) {
  const fl = 0.7 + Math.sin(t * 4 + ph) * 0.15 + Math.sin(t * 7 + ph * 2) * 0.1
  const r = (4 + rev * 4) * s * pu, hu = 35 + Math.sin(t * 0.5 + ph) * 15
  ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hu},70%,65%,${al * 0.12 * fl})`; ctx.fill()
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hu},75%,75%,${al * 0.8 * fl})`; ctx.fill()
  if (rev > 0.3) {
    const fa = (rev - 0.3) / 0.7 * al * 0.4 * fl
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.3 + ph) * 0.1)
    ctx.fillStyle = `hsla(${hu},50%,80%,${fa})`; ctx.fillRect(-3*s,-5*s,6*s,10*s)
    ctx.fillStyle = `hsla(${hu},40%,60%,${fa*0.6})`
    ctx.fillRect(-2*s,-3*s,4*s,0.8*s); ctx.fillRect(-2*s,-1*s,3*s,0.8*s); ctx.fillRect(-2*s,1*s,3.5*s,0.8*s)
    ctx.restore()
  }
}
function _drawArtifact(ctx: CanvasRenderingContext2D, x: number, y: number, rev: number, al: number, pu: number, t: number, ph: number, s: number) {
  const r = (6 + rev * 5) * s * pu, hu = 220 + Math.sin(t * 0.3 + ph) * 20
  ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hu},60%,55%,${al * 0.1})`; ctx.fill()
  ctx.beginPath()
  for (let j = 0; j <= 6; j++) { const a = (j/6)*Math.PI*2-Math.PI/2; const px=x+Math.cos(a)*r; const py=y+Math.sin(a)*r; j===0?ctx.moveTo(px,py):ctx.lineTo(px,py) }
  ctx.closePath(); ctx.strokeStyle = `hsla(${hu},65%,65%,${al*0.7})`; ctx.lineWidth = 1.5*s; ctx.stroke()
  ctx.fillStyle = `hsla(${hu},55%,50%,${al*0.2})`; ctx.fill()
  if (rev > 0.3) {
    const ir = r * 0.5; ctx.beginPath()
    for (let j = 0; j <= 6; j++) { const a=(j/6)*Math.PI*2; const px=x+Math.cos(a)*ir; const py=y+Math.sin(a)*ir; j===0?ctx.moveTo(px,py):ctx.lineTo(px,py) }
    ctx.closePath(); ctx.strokeStyle = `hsla(${hu},55%,60%,${(rev-0.3)/0.7*al*0.4})`; ctx.lineWidth = s; ctx.stroke()
  }
}
function _drawBio(ctx: CanvasRenderingContext2D, x: number, y: number, rev: number, al: number, pu: number, s: number) {
  const hu = 30, r = (5 + rev * 4) * s * pu
  ctx.beginPath(); ctx.arc(x, y, r * 5, 0, Math.PI * 2)
  ctx.fillStyle = `hsla(${hu},50%,50%,${al*0.08})`; ctx.fill()
  const sa = al * 0.7
  ctx.beginPath(); ctx.ellipse(x, y+2*s, r*1.1, r*0.5, 0, 0, Math.PI*2); ctx.fillStyle = `hsla(${hu},30%,45%,${sa})`; ctx.fill()
  ctx.beginPath(); ctx.ellipse(x, y-1*s, r*0.8, r*0.4, 0, 0, Math.PI*2); ctx.fillStyle = `hsla(${hu},35%,50%,${sa})`; ctx.fill()
  ctx.beginPath(); ctx.ellipse(x, y-4*s, r*0.5, r*0.3, 0, 0, Math.PI*2); ctx.fillStyle = `hsla(${hu},40%,55%,${sa})`; ctx.fill()
  if (rev > 0.5) {
    const ta = (rev-0.5)/0.5*al*0.5
    ctx.beginPath(); ctx.arc(x, y-6*s, r*0.3, 0, Math.PI*2); ctx.fillStyle = `hsla(${hu},70%,70%,${ta})`; ctx.fill()
  }
}

// ---- Entity Drawing ----

function drawEntities(ctx: CanvasRenderingContext2D, world: WorldState) {
  const { entities, time, scale, karma } = world
  const trustBoost = karma.trust * 0.3

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    if (!e.alive) continue

    const col = ENTITY_COLORS[e.kind]
    const pulse = Math.sin(time * 2 + e.phase) * 0.15 + 1

    if (e.kind === 'wanderer') {
      drawWanderer(ctx, e, col, pulse, scale, trustBoost)
    } else if (e.kind === 'fragile') {
      drawFragile(ctx, e, col, pulse, time, scale)
    } else if (e.kind === 'cooperator') {
      drawCooperator(ctx, e, col, pulse, scale, trustBoost)
    } else if (e.kind === 'defector') {
      drawDefector(ctx, e, col, pulse, time, scale)
    } else if (e.kind === 'corruptor') {
      drawCorruptor(ctx, e, col, pulse, time, scale)
    }
  }
}

function drawWanderer(ctx: CanvasRenderingContext2D, e: Entity, col: { r: number; g: number; b: number }, pulse: number, _s: number, trustBoost: number) {
  const r = e.radius * pulse
  const alpha = 0.4 + e.energy * 0.3 + trustBoost * 0.1

  // Soft glow halo
  const haloR = r * 4
  ctx.beginPath()
  ctx.arc(e.x, e.y, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.08})`
  ctx.fill()

  // Core
  ctx.beginPath()
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.6})`
  ctx.fill()

  // Bright center
  ctx.beginPath()
  ctx.arc(e.x, e.y, r * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${Math.min(255, col.r + 60)}, ${Math.min(255, col.g + 60)}, ${Math.min(255, col.b + 40)}, ${alpha * 0.8})`
  ctx.fill()
}

function drawFragile(ctx: CanvasRenderingContext2D, e: Entity, col: { r: number; g: number; b: number }, pulse: number, time: number, _s: number) {
  const r = e.radius * (0.7 + e.energy * 0.3) * pulse
  // Flickering — dim and unsteady
  const flicker = 0.5 + Math.sin(time * 5 + e.phase) * 0.2 + Math.sin(time * 8.3 + e.phase * 2) * 0.15
  const alpha = (0.2 + e.energy * 0.4) * flicker

  // Dim warm glow
  const haloR = r * 3
  ctx.beginPath()
  ctx.arc(e.x, e.y, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.06})`
  ctx.fill()

  // Small flickering core
  ctx.beginPath()
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.5})`
  ctx.fill()
}

function drawCooperator(ctx: CanvasRenderingContext2D, e: Entity, col: { r: number; g: number; b: number }, pulse: number, _s: number, trustBoost: number) {
  const r = e.radius * pulse * (1 + trustBoost * 0.2)
  const alpha = 0.5 + e.energy * 0.3 + e.beauty * 0.2

  // Warm glow halo — larger and brighter
  const haloR = r * 5
  ctx.beginPath()
  ctx.arc(e.x, e.y, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.1})`
  ctx.fill()

  // Core
  ctx.beginPath()
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.65})`
  ctx.fill()

  // Inner glow
  ctx.beginPath()
  ctx.arc(e.x, e.y, r * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${Math.min(255, col.r + 80)}, ${Math.min(255, col.g + 40)}, ${Math.min(255, col.b + 60)}, ${alpha * 0.85})`
  ctx.fill()
}

function drawDefector(ctx: CanvasRenderingContext2D, e: Entity, col: { r: number; g: number; b: number }, pulse: number, time: number, _s: number) {
  const r = e.radius * pulse
  const alpha = 0.4 + e.hostility * 0.3

  // Angular halo
  const haloR = r * 3.5
  ctx.beginPath()
  ctx.arc(e.x, e.y, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.06})`
  ctx.fill()

  // Angular core — hexagonal
  ctx.beginPath()
  const sides = 6
  for (let j = 0; j <= sides; j++) {
    const a = (j / sides) * Math.PI * 2
    const wobble = 1 + Math.sin(a * 2 + time * 3) * 0.15
    const px = e.x + Math.cos(a) * r * wobble
    const py = e.y + Math.sin(a) * r * wobble
    if (j === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.55})`
  ctx.fill()

  // Red-amber center
  ctx.beginPath()
  ctx.arc(e.x, e.y, r * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(220, 100, 60, ${alpha * 0.7})`
  ctx.fill()
}

function drawCorruptor(ctx: CanvasRenderingContext2D, e: Entity, col: { r: number; g: number; b: number }, pulse: number, time: number, s: number) {
  const r = e.radius * pulse
  const alpha = 0.4 + e.corruption * 0.4

  // Sickly halo with distortion
  const haloR = r * 5
  const distort = Math.sin(time * 4 + e.phase) * 0.2
  ctx.beginPath()
  ctx.arc(e.x + distort * r, e.y, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.1})`
  ctx.fill()

  // Dark thorny core — irregular spikes
  ctx.beginPath()
  const spikes = 8
  for (let j = 0; j <= spikes; j++) {
    const a = (j / spikes) * Math.PI * 2
    const spike = 1 + Math.sin(a * 3 + time * 2.5 + e.phase) * 0.3
    const px = e.x + Math.cos(a) * r * spike
    const py = e.y + Math.sin(a) * r * spike
    if (j === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = `rgba(60, 70, 50, ${alpha * 0.7})`
  ctx.fill()

  // Sickly inner glow
  ctx.beginPath()
  ctx.arc(e.x, e.y, r * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(100, 130, 80, ${alpha * 0.5 + Math.sin(time * 6 + e.phase) * 0.15})`
  ctx.fill()

  // Static distortion lines near high-corruption corruptors
  if (e.corruption > 0.5) {
    ctx.globalAlpha = alpha * 0.15
    for (let j = 0; j < 3; j++) {
      const lx = e.x + (Math.random() - 0.5) * r * 4
      const ly = e.y + (Math.random() - 0.5) * r * 3
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(lx + (Math.random() - 0.5) * r * 2, ly + (Math.random() - 0.5) * r)
      ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, 0.4)`
      ctx.lineWidth = 1 * s
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

// ---- Death State ----

function drawEmber(ctx: CanvasRenderingContext2D, world: WorldState) {
  const { player, time, scale } = world
  if (!player.emberVisible) return

  const pulse = Math.sin(time * 3) * 0.3 + 0.7
  const r = 6 * scale * pulse

  // Faint warm glow
  const haloR = r * 6
  ctx.beginPath()
  ctx.arc(player.emberX, player.emberY, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 160, 60, ${0.06 * pulse})`
  ctx.fill()

  // Ember core
  ctx.beginPath()
  ctx.arc(player.emberX, player.emberY, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 180, 80, ${0.5 * pulse})`
  ctx.fill()

  // Bright center
  ctx.beginPath()
  ctx.arc(player.emberX, player.emberY, r * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 220, 150, ${0.8 * pulse})`
  ctx.fill()
}

// ---- Karma Visual Consequences ----

function drawKarmaOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  const { karma } = world

  // High corruption: sickly green-gray edge tint (simple rects for vignette)
  if (karma.corruption > 0.3) {
    const intensity = (karma.corruption - 0.3) * 0.12
    ctx.fillStyle = `rgba(40, 50, 35, ${intensity})`
    const edge = w * 0.12
    ctx.fillRect(0, 0, edge, h)
    ctx.fillRect(w - edge, 0, edge, h)
    ctx.fillRect(0, 0, w, edge)
    ctx.fillRect(0, h - edge, w, edge)
  }

  // High hostility: cold edge tint (simple rects for vignette)
  if (karma.hostility > 0.4) {
    const intensity = (karma.hostility - 0.4) * 0.08
    ctx.fillStyle = `rgba(30, 35, 60, ${intensity})`
    const edge = w * 0.1
    ctx.fillRect(0, 0, edge, h)
    ctx.fillRect(w - edge, 0, edge, h)
    ctx.fillRect(0, 0, w, edge)
    ctx.fillRect(0, h - edge, w, edge)
  }
}

function drawMuteGlyph(ctx: CanvasRenderingContext2D, w: number, h: number, muted: boolean, hovering: boolean) {
  const dpr = window.devicePixelRatio || 1
  const cx = w - 36 * dpr
  const cy = h - 36 * dpr
  const r = 10 * dpr
  const alpha = hovering ? 0.5 : 0.25

  ctx.save()

  // Outer circle
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = `hsla(180, 50%, 70%, ${alpha})`
  ctx.lineWidth = 1.2 * dpr
  ctx.stroke()

  if (muted) {
    // X mark when muted
    const s = r * 0.5
    ctx.beginPath()
    ctx.moveTo(cx - s, cy - s)
    ctx.lineTo(cx + s, cy + s)
    ctx.moveTo(cx + s, cy - s)
    ctx.lineTo(cx - s, cy + s)
    ctx.strokeStyle = `hsla(180, 50%, 70%, ${alpha})`
    ctx.lineWidth = 1.2 * dpr
    ctx.stroke()
  } else {
    // Sound waves when unmuted — two small arcs
    for (let i = 1; i <= 2; i++) {
      const arcR = r * 0.25 * i
      ctx.beginPath()
      ctx.arc(cx - r * 0.15, cy, arcR, -Math.PI * 0.35, Math.PI * 0.35)
      ctx.strokeStyle = `hsla(180, 50%, 70%, ${alpha * (1 - i * 0.25)})`
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }
    // Small dot at center
    ctx.beginPath()
    ctx.arc(cx - r * 0.25, cy, 1.5 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(180, 50%, 70%, ${alpha})`
    ctx.fill()
  }

  ctx.restore()
}
