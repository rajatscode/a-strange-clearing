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
    // Convert screen coordinates to world space
    world.player.targetX = clientX * dpr + world.camera.x
    world.player.targetY = clientY * dpr + world.camera.y

    // First interaction spark
    if (!world.firstInteraction) {
      world.firstInteraction = true
      addRipple(world, world.player.x, world.player.y)
      if (audioRef.current) {
        audioRef.current.start()
      }
    }

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

    // Convert screen coordinates to world space
    const cx = clientX * dpr + world.camera.x
    const cy = clientY * dpr + world.camera.y

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
            entityDeath: world.worldEvents.entityDeath,
            beautyBloom: world.worldEvents.beautyBloom,
            starFormed: world.worldEvents.starFormed,
            transcendence: world.worldEvents.transcendence,
            corruptionSpread: world.worldEvents.corruptionSpread,
            cleanseSuccess: world.worldEvents.cleanseSuccess,
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
  const cam = world.camera

  // Background and fog are drawn in screen space (no camera offset)
  drawBackground(ctx, w, h, world)

  // Apply camera transform for all world-space drawing
  ctx.save()
  ctx.translate(-cam.x, -cam.y)

  drawStars(ctx, world, cam, w, h)
  drawFog(ctx, w, h, world, cam)
  drawGroundScars(ctx, world, cam, w, h)
  drawParticlesForLayer(ctx, world, 0, cam, w, h)
  drawConnectionLines(ctx, world, w, h, cam)
  drawParticlesForLayer(ctx, world, 1, cam, w, h)
  drawGrass(ctx, world, h, cam, w)
  drawFragments(ctx, world, cam, w, h)
  drawEntities(ctx, world, cam, w, h)
  drawDeathParticles(ctx, world, cam, w, h)
  drawBeautyBlooms(ctx, world, cam, w, h)
  drawParticlesForLayer(ctx, world, 2, cam, w, h)
  drawNavNodes(ctx, world, cam, w, h)
  drawRipples(ctx, world, world.scale, cam, w, h)
  drawFlashes(ctx, world, world.scale, cam, w, h)

  if (isDead) {
    drawEmber(ctx, world)
  } else {
    drawPlayerTrail(ctx, world.player, world.scale)
    drawPlayer(ctx, world.player, world.time, world.scale)
  }

  ctx.restore()

  // UI overlays in screen space
  if (isDead) {
    ctx.fillStyle = 'rgba(10, 12, 15, 0.35)'
    ctx.fillRect(0, 0, w, h)
  }

  drawKarmaOverlay(ctx, w, h, world)
  drawLookCloserNudge(ctx, w, h, world)
}

type Camera = { x: number; y: number }

function onScreen(x: number, y: number, cam: Camera, w: number, h: number, margin: number = 100): boolean {
  return x >= cam.x - margin && x <= cam.x + w + margin && y >= cam.y - margin && y <= cam.y + h + margin
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  const { mood, smoothKarma: karma } = world

  // Dramatic karma influence on background (uses smoothed values for gradual transition)
  const beautyHue = karma.beauty > 0.6 ? (karma.beauty - 0.6) * 60 : karma.beauty * 12
  const corruptHue = karma.corruption > 0.5 ? (karma.corruption - 0.5) * -40 : karma.corruption * -8
  const bShift = beautyHue + corruptHue

  // Saturation: beauty boosts, corruption kills
  const beautySat = karma.beauty > 0.6 ? (karma.beauty - 0.6) * 30 : 0
  const corruptSat = karma.corruption > 0.5 ? (karma.corruption - 0.5) * -25 : 0

  // Lightness: beauty brightens, corruption darkens
  const beautyLit = karma.beauty > 0.6 ? (karma.beauty - 0.6) * 12 : 0
  const corruptLit = karma.corruption > 0.5 ? (karma.corruption - 0.5) * -6 : 0

  const bands = [
    { y: 0,        frac: 0.35, hue: 225 + bShift, sat: 25 + mood.saturation * 15 + beautySat + corruptSat, lit: 4 + mood.brightness * 4 + beautyLit + corruptLit },
    { y: h * 0.35, frac: 0.25, hue: 215 + bShift, sat: 20 + mood.saturation * 10 + beautySat + corruptSat, lit: 5 + mood.brightness * 3 + beautyLit + corruptLit },
    { y: h * 0.6,  frac: 0.25, hue: 175 + bShift, sat: 22 + mood.saturation * 12 + beautySat + corruptSat, lit: 5 + mood.brightness * 3 + beautyLit + corruptLit },
    { y: h * 0.85, frac: 0.15, hue: 150 + bShift, sat: 28 + mood.saturation * 10 + beautySat + corruptSat, lit: 4 + mood.brightness * 3 + beautyLit + corruptLit },
  ]
  ctx.fillStyle = `hsl(${135 + bShift}, ${Math.max(5, 30 + mood.saturation * 8 + beautySat + corruptSat)}%, ${Math.max(1, 3 + mood.brightness * 2 + beautyLit + corruptLit)}%)`
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

function drawFog(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState, cam: Camera) {
  const { mood, time, smoothKarma: karma } = world

  // Fog responds to karma:
  // Beauty: warmer, golden/green tint, slightly thinner
  // Corruption: thicker, gray, sickly
  // Hostility: cold blue-purple tint
  const corruptThicken = karma.corruption > 0.5 ? (karma.corruption - 0.5) * 0.12 : 0
  const beautyThin = karma.beauty > 0.6 ? (karma.beauty - 0.6) * -0.04 : 0
  const fogAlpha = 0.04 + mood.fogAmount * 0.06 + corruptThicken + beautyThin

  // Hue shifts: beauty = warm green (150-160), corruption = gray (100), hostility = cold blue-purple (240)
  const fogHue = karma.corruption > 0.5
    ? 100 + (1 - karma.corruption) * 40  // gray-sickly
    : karma.hostility > 0.6
      ? 240 - (1 - karma.hostility) * 30  // cold blue-purple
      : karma.beauty > 0.6
        ? 150 + (karma.beauty - 0.6) * 30  // warm golden-green
        : 175
  const fogSat = karma.corruption > 0.5
    ? 10 + (1 - karma.corruption) * 10  // desaturated
    : karma.beauty > 0.6
      ? 30 + (karma.beauty - 0.6) * 20  // warm saturation
      : 25

  const cx = cam.x
  const cy = cam.y

  // Horizon fog
  const horizonY = cy + h * 0.45
  const horizonH = h * 0.3
  ctx.fillStyle = `hsla(${fogHue}, ${fogSat}%, 25%, ${fogAlpha * 1.8})`
  ctx.fillRect(cx, horizonY, w, horizonH)
  ctx.fillStyle = `hsla(${fogHue + 15}, ${fogSat - 5}%, 18%, ${fogAlpha * 0.8})`
  ctx.fillRect(cx, horizonY - h * 0.1, w, horizonH + h * 0.2)

  // Ground glow
  ctx.fillStyle = `hsla(${fogHue - 15}, ${fogSat + 5}%, 10%, ${fogAlpha * 1.2})`
  ctx.fillRect(cx, cy + h * 0.8, w, h * 0.2)
  ctx.fillStyle = `hsla(${fogHue - 25}, ${fogSat}%, 8%, ${fogAlpha * 1.5})`
  ctx.fillRect(cx, cy + h * 0.9, w, h * 0.1)

  // Drifting mist patches
  for (let i = 0; i < 2; i++) {
    const mx = cx + w * (0.1 + i * 0.4) + Math.sin(time * 0.04 + i * 1.7) * w * 0.12
    const my = cy + h * (0.3 + i * 0.15) + Math.cos(time * 0.025 + i * 2.3) * h * 0.05
    const mw = w * 0.4
    const mh = h * 0.15
    ctx.fillStyle = `hsla(${fogHue + i * 15}, ${fogSat - 5}%, 22%, ${fogAlpha * 0.7})`
    ctx.fillRect(mx - mw / 2, my - mh / 2, mw, mh)
  }
}

function drawParticlesForLayer(ctx: CanvasRenderingContext2D, world: WorldState, layer: number, cam: Camera, w: number, h: number) {
  const { smoothKarma: karma } = world
  const layerScale = layer === 0 ? 0.6 : layer === 1 ? 1.0 : 1.5
  const alphaBase = layer === 0 ? 0.4 : layer === 1 ? 0.6 : 0.8

  // Beauty: brighter particles, warmer hues
  // Corruption: dimmer, colder/grayer
  const beautyBright = karma.beauty > 0.6 ? 1.0 + (karma.beauty - 0.6) * 1.5 : 1.0
  const corruptDim = karma.corruption > 0.5 ? 1.0 - (karma.corruption - 0.5) * 0.6 : 1.0
  const brightMult = beautyBright * corruptDim

  // Hue shift: corruption → gray/cold (sat drop), beauty → warmer
  const satMult = karma.corruption > 0.5
    ? 0.3 + (1 - karma.corruption) * 0.7  // desaturated
    : 1.0 + (karma.beauty > 0.6 ? (karma.beauty - 0.6) * 0.5 : 0) // more vivid

  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i]
    if (p.layer !== layer) continue
    if (!onScreen(p.x, p.y, cam, w, h)) continue

    // Corruption: skip some particles (fewer visible)
    if (karma.corruption > 0.5 && (i % 3 === 0)) continue

    const r = p.radius * layerScale
    const alpha = p.brightness * alphaBase * brightMult

    if (alpha < 0.05) continue

    const sat = Math.round(60 * satMult)
    const coreSat = Math.round(70 * satMult)

    const haloR = r * 5
    ctx.beginPath()
    ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, ${sat}%, 55%, ${alpha * 0.06})`
    ctx.fill()

    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, ${coreSat}%, 85%, ${alpha * 0.9})`
    ctx.fill()
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, world: WorldState, _h: number, cam: Camera, vpW: number) {
  const { mood, smoothKarma: karma, time } = world
  const s = world.scale

  // Dramatic karma influence on grass appearance
  // Beauty: more luminous tips, brighter, taller, warmer green
  // Corruption: fewer luminous tips, gray/brown, dimmer, shorter
  const beautyFactor = karma.beauty > 0.6 ? (karma.beauty - 0.6) / 0.4 : 0 // 0-1 for beauty > 0.6
  const corruptFactor = karma.corruption > 0.5 ? (karma.corruption - 0.5) / 0.5 : 0 // 0-1 for corruption > 0.5
  const hostileFactor = karma.hostility > 0.6 ? (karma.hostility - 0.6) / 0.4 : 0

  // Luminous threshold: beauty 15%→40%, corruption 15%→5%
  const luminousThreshold = karma.corruption > 0.5
    ? 0.05 + (1 - corruptFactor) * 0.10
    : 0.15 + beautyFactor * 0.25

  // Base colors: beauty = vibrant green, corruption = gray-brown
  const baseHue = karma.corruption > 0.5
    ? 80 + (1 - corruptFactor) * 55 // shifts toward brown/gray
    : 135 + mood.hueBias * 0.05 + beautyFactor * 15 // warmer green
  const baseSat = karma.corruption > 0.5
    ? 10 + (1 - corruptFactor) * 25 // very desaturated
    : 35 + karma.beauty * 25 + beautyFactor * 15 // more vivid
  const baseLit = karma.corruption > 0.5
    ? 10 + (1 - corruptFactor) * 8 // dimmer
    : 18 + karma.beauty * 14 + beautyFactor * 8 // brighter

  // Height multiplier: beauty = taller, corruption = shorter
  const heightMult = 1.0 + beautyFactor * 0.3 - corruptFactor * 0.3

  // Wind multiplier: hostility = more erratic
  const windMult = 1.0 + hostileFactor * 1.5

  ctx.lineCap = 'round'

  const h = world.worldHeight
  for (let i = 0; i < world.grass.length; i++) {
    const blade = world.grass[i]
    if (blade.x < cam.x - 50 || blade.x > cam.x + vpW + 50) continue
    const baseY = h
    const effectiveHeight = blade.baseHeight * heightMult
    const bendOffset = blade.bend * windMult * effectiveHeight * 0.5
    const tipX = blade.x + bendOffset
    const tipY = baseY - effectiveHeight
    const cpX = blade.x + bendOffset * 0.4
    const cpY = baseY - effectiveHeight * 0.5

    const strokeW = 1.5 * s + effectiveHeight * 0.008

    // Gravitational shimmer: grass near hidden nav nodes glows warmer
    let navGlow = 0
    for (let n = 0; n < world.navNodes.length; n++) {
      const node = world.navNodes[n]
      const ndx = blade.x - node.x
      const ndy = tipY - node.y
      const ndist = Math.sqrt(ndx * ndx + ndy * ndy)
      if (ndist < 100 * s) {
        navGlow = Math.max(navGlow, (1 - ndist / (100 * s)) * 0.3)
      }
    }

    // Determine if this blade should be luminous based on karma
    const isLuminous = blade.luminous || (blade.phase / (Math.PI * 2)) < luminousThreshold || navGlow > 0.1

    if (isLuminous && !corruptFactor) {
      const glowPulse = 0.4 + Math.sin(time * 1.8 + blade.phase) * 0.3 + Math.sin(time * 0.7 + blade.phase * 2) * 0.2

      const glowSize = (18 + glowPulse * 12 + beautyFactor * 8 + navGlow * 10) * s
      const navWarmth = navGlow > 0 ? navGlow * 15 : 0
      ctx.beginPath()
      ctx.arc(tipX, tipY, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${blade.hue - navWarmth}, 75%, ${60 + navGlow * 15}%, ${(0.08 + glowPulse * 0.12 + navGlow * 0.06) * (1 + beautyFactor * 0.5)})`
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(blade.x, baseY)
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY)
      ctx.strokeStyle = `hsl(${blade.hue}, 70%, ${22 + glowPulse * 20 + beautyFactor * 10}%)`
    } else {
      ctx.beginPath()
      ctx.moveTo(blade.x, baseY)
      ctx.quadraticCurveTo(cpX, cpY, tipX, tipY)
      const heightFrac = effectiveHeight / (320 * s)
      const lit = baseLit * (0.5 + heightFrac * 0.5)
      const sat = baseSat * (0.5 + heightFrac * 0.5)
      ctx.strokeStyle = `hsl(${baseHue + heightFrac * 15}, ${Math.max(5, sat)}%, ${Math.max(3, lit)}%)`
    }

    ctx.lineWidth = Math.max(strokeW, 2 * s)
    ctx.stroke()
  }
}

function drawRipples(ctx: CanvasRenderingContext2D, world: WorldState, scale: number, cam: Camera, w: number, h: number) {
  const hue = 175 + world.karma.beauty * 25

  for (let i = 0; i < world.ripples.length; i++) {
    const r = world.ripples[i]
    if (r.alpha < 0.02) continue
    if (!onScreen(r.x, r.y, cam, w, h, r.radius + 100)) continue

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

function drawFlashes(ctx: CanvasRenderingContext2D, world: WorldState, scale: number, cam: Camera, w: number, h: number) {
  for (let i = 0; i < world.flashes.length; i++) {
    const f = world.flashes[i]
    if (f.alpha < 0.03) continue
    if (!onScreen(f.x, f.y, cam, w, h, f.radius + 100)) continue

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

function drawNavNodes(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, w: number, h: number) {
  const { navNodes, time, scale: s } = world
  for (let i = 0; i < navNodes.length; i++) {
    const n = navNodes[i]
    if (n.revealed < 0.05) continue
    if (!onScreen(n.x, n.y, cam, w, h, 200)) continue
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

function drawEntities(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, w: number, h: number) {
  const { entities, time, scale, karma } = world
  const trustBoost = karma.trust * 0.3

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    if (!e.alive) continue
    if (!onScreen(e.x, e.y, cam, w, h, e.radius * 6)) continue

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
  // Shrink dramatically when drained
  const energyScale = 0.4 + e.energy * 0.6
  const r = e.radius * energyScale * pulse
  // Flickering — more frantic when low energy
  const flickerSpeed = e.energy < 0.3 ? 12 : 5
  const flickerAmp = e.energy < 0.3 ? 0.35 : 0.2
  const flicker = 0.5 + Math.sin(time * flickerSpeed + e.phase) * flickerAmp + Math.sin(time * 8.3 + e.phase * 2) * 0.15
  const alpha = (0.15 + e.energy * 0.5) * flicker

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
  const r = e.radius * pulse * (1 + trustBoost * 0.3)
  const alpha = 0.6 + e.energy * 0.3 + e.beauty * 0.2

  // Large warm bloom halo — 2x bigger, brighter
  const haloR = r * 8
  ctx.beginPath()
  ctx.arc(e.x, e.y, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.08})`
  ctx.fill()

  // Secondary glow ring
  const midR = r * 4
  ctx.beginPath()
  ctx.arc(e.x, e.y, midR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.12})`
  ctx.fill()

  // Core
  ctx.beginPath()
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.7})`
  ctx.fill()

  // Bright inner glow
  ctx.beginPath()
  ctx.arc(e.x, e.y, r * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(${Math.min(255, col.r + 100)}, ${Math.min(255, col.g + 60)}, ${Math.min(255, col.b + 80)}, ${alpha * 0.9})`
  ctx.fill()
}

function drawDefector(ctx: CanvasRenderingContext2D, e: Entity, col: { r: number; g: number; b: number }, pulse: number, time: number, _s: number) {
  const r = e.radius * pulse
  const alpha = 0.5 + e.hostility * 0.35

  // Angry red halo — larger and more visible
  const haloR = r * 4.5
  ctx.beginPath()
  ctx.arc(e.x, e.y, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(240, 80, 40, ${alpha * 0.10})`
  ctx.fill()

  // Angular core — hexagonal, larger
  ctx.beginPath()
  const sides = 6
  for (let j = 0; j <= sides; j++) {
    const a = (j / sides) * Math.PI * 2
    const wobble = 1 + Math.sin(a * 2 + time * 3) * 0.20
    const px = e.x + Math.cos(a) * r * wobble
    const py = e.y + Math.sin(a) * r * wobble
    if (j === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha * 0.65})`
  ctx.fill()

  // Bright red center — unmistakable
  ctx.beginPath()
  ctx.arc(e.x, e.y, r * 0.45, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 70, 40, ${alpha * 0.85})`
  ctx.fill()
}

function drawCorruptor(ctx: CanvasRenderingContext2D, e: Entity, col: { r: number; g: number; b: number }, pulse: number, time: number, s: number) {
  const r = e.radius * pulse
  const alpha = 0.4 + e.corruption * 0.4

  // Pulsing dark aura — large, unmistakable
  const auraPulse = 1 + Math.sin(time * 2 + e.phase) * 0.25
  const auraR = e.radius * 4 * auraPulse
  ctx.beginPath()
  ctx.arc(e.x, e.y, auraR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(40, 50, 30, ${0.12 * e.corruption})`
  ctx.fill()

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

  // Irregular, weak flickering — barely holding on
  const flicker = Math.sin(time * 4) * Math.sin(time * 7.3) * Math.sin(time * 2.1)
  const pulse = 0.3 + flicker * 0.25 + Math.sin(time * 11.7) * 0.1
  const r = 5 * scale * Math.max(0.3, pulse)

  // Faint warm glow — fluttering
  const haloR = r * 5
  ctx.beginPath()
  ctx.arc(player.emberX, player.emberY, haloR, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 160, 60, ${0.04 * Math.max(0, pulse)})`
  ctx.fill()

  // Ember core — weak
  ctx.beginPath()
  ctx.arc(player.emberX, player.emberY, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 180, 80, ${0.35 * Math.max(0, pulse)})`
  ctx.fill()

  // Bright center — barely there
  ctx.beginPath()
  ctx.arc(player.emberX, player.emberY, r * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 220, 150, ${0.6 * Math.max(0, pulse)})`
  ctx.fill()
}

// ---- Karma Visual Consequences ----

function drawKarmaOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  const { smoothKarma: karma } = world

  // High corruption: sickly green-gray vignette — MUCH more visible
  if (karma.corruption > 0.3) {
    const intensity = (karma.corruption - 0.3) * 0.25
    ctx.fillStyle = `rgba(40, 50, 35, ${intensity})`
    const edge = w * 0.18
    ctx.fillRect(0, 0, edge, h)
    ctx.fillRect(w - edge, 0, edge, h)
    ctx.fillRect(0, 0, w, edge)
    ctx.fillRect(0, h - edge, w, edge)
  }

  // High hostility: cold blue-purple vignette — more intense
  if (karma.hostility > 0.4) {
    const intensity = (karma.hostility - 0.4) * 0.18
    ctx.fillStyle = `rgba(30, 25, 70, ${intensity})`
    const edge = w * 0.15
    ctx.fillRect(0, 0, edge, h)
    ctx.fillRect(w - edge, 0, edge, h)
    ctx.fillRect(0, 0, w, edge)
    ctx.fillRect(0, h - edge, w, edge)
  }

  // High beauty: warm golden glow at edges
  if (karma.beauty > 0.6) {
    const intensity = (karma.beauty - 0.6) * 0.08
    ctx.fillStyle = `rgba(80, 120, 60, ${intensity})`
    const edge = w * 0.1
    ctx.fillRect(0, h - edge, w, edge)
  }
}

function drawStars(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, w: number, h: number) {
  for (let i = 0; i < world.stars.length; i++) {
    const star = world.stars[i]
    if (!onScreen(star.x, star.y, cam, w, h)) continue
    const twinkle = 0.5 + Math.sin(world.time * 3 + star.phase) * 0.3 + Math.sin(world.time * 7 + star.phase * 2.3) * 0.2
    const alpha = star.brightness * twinkle
    const r = (1.5 + star.brightness * 1.5) * world.scale

    // Soft glow
    ctx.beginPath()
    ctx.arc(star.x, star.y, r * 4, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(200, 60%, 80%, ${alpha * 0.1})`
    ctx.fill()

    // Core
    ctx.beginPath()
    ctx.arc(star.x, star.y, r, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(200, 70%, 90%, ${alpha * 0.8})`
    ctx.fill()
  }
}

function drawDeathParticles(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, w: number, h: number) {
  for (let i = 0; i < world.deathParticles.length; i++) {
    const p = world.deathParticles[i]
    if (p.alpha < 0.02) continue
    if (!onScreen(p.x, p.y, cam, w, h)) continue
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.alpha})`
    ctx.fill()
  }
}

function drawBeautyBlooms(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, w: number, h: number) {
  for (let i = 0; i < world.beautyBlooms.length; i++) {
    const b = world.beautyBlooms[i]
    if (b.alpha < 0.02) continue
    if (!onScreen(b.x, b.y, cam, w, h, b.radius + 100)) continue

    // Outer ring
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(${b.hue}, 65%, 65%, ${b.alpha * 0.5})`
    ctx.lineWidth = 2 * world.scale
    ctx.stroke()

    // Inner fill
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${b.hue}, 55%, 55%, ${b.alpha * 0.08})`
    ctx.fill()
  }
}

function drawConnectionLines(ctx: CanvasRenderingContext2D, world: WorldState, w: number, h: number, cam: Camera) {
  const colors: Record<string, string> = {
    cooperate: '160, 70%, 60%',
    hunt: '20, 70%, 55%',
    corrupt: '90, 30%, 45%',
    nourish: '180, 65%, 65%',
  }

  for (let i = 0; i < world.connectionLines.length; i++) {
    const line = world.connectionLines[i]
    if (line.alpha < 0.02) continue
    // Only draw if both endpoints are on screen
    if (!onScreen(line.x1, line.y1, cam, w, h) || !onScreen(line.x2, line.y2, cam, w, h)) continue
    ctx.beginPath()
    ctx.moveTo(line.x1, line.y1)
    ctx.lineTo(line.x2, line.y2)
    ctx.strokeStyle = `hsla(${colors[line.kind]}, ${line.alpha})`
    ctx.lineWidth = (line.kind === 'hunt' ? 2.0 : line.kind === 'corrupt' ? 1.5 : 1.0) * world.scale
    ctx.stroke()
  }
}

function drawGroundScars(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, w: number, h: number) {
  for (let i = 0; i < world.groundScars.length; i++) {
    const scar = world.groundScars[i]
    if (scar.alpha < 0.02) continue
    if (!onScreen(scar.x, scar.y, cam, w, h, scar.radius + 50)) continue
    ctx.beginPath()
    ctx.arc(scar.x, scar.y, scar.radius, 0, Math.PI * 2)
    if (scar.dark) {
      ctx.fillStyle = `rgba(10, 12, 8, ${scar.alpha * 0.4})`
    } else {
      ctx.fillStyle = `hsla(170, 50%, 60%, ${scar.alpha * 0.15})`
    }
    ctx.fill()
  }
}

function drawFragments(ctx: CanvasRenderingContext2D, world: WorldState, cam: Camera, w: number, h: number) {
  const s = world.scale
  const beautyWarmth = world.smoothKarma.beauty * 20

  for (let i = 0; i < world.fragments.length; i++) {
    const f = world.fragments[i]
    if (f.alpha < 0.01) continue
    if (!onScreen(f.x, f.y, cam, w, h, 200)) continue

    ctx.save()
    ctx.font = `${Math.round(14 * s)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillStyle = `hsla(${180 - beautyWarmth}, 40%, 70%, ${f.alpha})`
    ctx.fillText(f.text, f.x, f.y)
    ctx.restore()
  }
}

function drawLookCloserNudge(ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldState) {
  if (world.time < 20) return
  const anyRevealed = world.navNodes.some(n => n.revealed > 0.7)
  if (anyRevealed) return
  // Don't show if fragment system already showed "look closer" or any fragment is visible
  if (world.shownFragments.has('look closer') || world.fragments.length > 0) return

  // Fade in over 3 seconds after 20s mark
  const fadeProgress = Math.min(1, (world.time - 20) / 3)
  const alpha = 0.25 * fadeProgress

  const dpr = window.devicePixelRatio || 1
  const s = world.scale

  ctx.save()
  ctx.font = `${Math.round(11 * s)}px monospace`
  ctx.textAlign = 'center'
  ctx.fillStyle = `rgba(180, 200, 190, ${alpha})`
  ctx.fillText('l o o k   c l o s e r', w / 2, h - 40 * dpr)
  ctx.restore()
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
