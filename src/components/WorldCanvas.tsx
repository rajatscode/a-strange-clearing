import { useRef, useEffect, useCallback, useState } from 'react'
import type { WorldState } from '../lib/simulation'
import { createWorld, updateWorld, addRipple, handleWorldClick, findNavNodeAt, findFalseBeaconAt, triggerFalseBeaconTrap, addFlash } from '../lib/simulation'
import { drawCentipede } from '../lib/render-centipede'
import { drawTree, drawVoidBackground, drawAtmosphere } from '../lib/render-tree'
import { drawAgents } from '../lib/render-agents'
import { drawStarField } from '../lib/render-stars'
import { drawPot } from '../lib/render-pot'
import { handlePotClick } from '../lib/pot'
import { getHeadPosition, getReach } from '../lib/centipede'
import { getReachableLeaves } from '../lib/tree'
import { AudioEngine } from './AudioEngine'

const MAX_DPR = 1.5
function getDPR() { return Math.min(window.devicePixelRatio || 1, MAX_DPR) }

export default function WorldCanvas({ onNavigate, muffled }: { onNavigate?: (route: string) => void; muffled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<WorldState | null>(null)
  const lastMouseRef = useRef({ x: 0, y: 0, time: 0 })
  const audioRef = useRef<AudioEngine | null>(null)
  const clickedThisFrame = useRef(false)
  const muteHover = useRef(false)
  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate
  const [canvasFailed, setCanvasFailed] = useState(false)

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    const world = worldRef.current
    if (!world) return

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

    const dpr = getDPR()
    // Store screen coords — world-space conversion happens in updateWorld each frame
    // to avoid camera feedback loop (camera moves → mouse world pos changes → camera moves)
    world.mouseScreenX = clientX * dpr
    world.mouseScreenY = clientY * dpr

    if (!world.firstInteraction) {
      world.firstInteraction = true
      addRipple(world, world.player.x, world.player.y)
      if (audioRef.current) {
        audioRef.current.start()
      }
    }

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

    if (audioRef.current) {
      audioRef.current.start()
    }

    const dpr = getDPR()

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

    const cx = clientX * dpr + world.camera.x
    const cy = clientY * dpr + world.camera.y

    const fbIdx = findFalseBeaconAt(world, cx, cy)
    if (fbIdx >= 0) {
      triggerFalseBeaconTrap(world, fbIdx)
      clickedThisFrame.current = true
      return
    }

    const navNode = findNavNodeAt(world, cx, cy)
    if (navNode && onNavigateRef.current) {
      onNavigateRef.current(navNode.route)
      return
    }

    // Handle pot click if pot is active
    if (world.pot.active && !world.pot.resolved) {
      handlePotClick(world.pot)
      clickedThisFrame.current = true
      return
    }

    const result = handleWorldClick(world, cx, cy)
    clickedThisFrame.current = true

    switch (result.type) {
      case 'ripple':
        addRipple(world, cx, cy)
        break
      case 'fragile_nourish':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 220, 180, 80)
        break
      case 'cooperator_exchange':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 80, 230, 190)
        break
      case 'corruptor_cleanse_success':
        addRipple(world, cx, cy)
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 200, 240, 255, 100)
        break
      case 'corruptor_cleanse_fail':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 100, 130, 70)
        break
      case 'defector_risk':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 220, 100, 60)
        break
      case 'ember_revive':
        addRipple(world, cx, cy)
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 255, 200, 100, 90)
        break
      case 'fragile_harvest':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 80, 120, 200, 70)
        addFlash(world, world.player.x, world.player.y, 200, 220, 255, 40)
        break
      case 'cooperator_drain':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 140, 80, 200, 90)
        addFlash(world, world.player.x, world.player.y, 220, 200, 255, 50)
        break
      case 'corruption_ripple':
        addRipple(world, cx, cy)
        addFlash(world, cx, cy, 60, 50, 80, 100)
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
    if (!ctx) {
      setCanvasFailed(true)
      return
    }

    let alive = true

    if (!audioRef.current) {
      audioRef.current = new AudioEngine()
    }

    function resize() {
      const dpr = getDPR()
      canvas!.width = window.innerWidth * dpr
      canvas!.height = window.innerHeight * dpr
      canvas!.style.width = window.innerWidth + 'px'
      canvas!.style.height = window.innerHeight + 'px'

      if (!worldRef.current) {
        worldRef.current = createWorld(canvas!.width, canvas!.height)
      } else {
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

        if (Math.floor(world.time * 0.5) !== Math.floor((world.time - dt) * 0.5)) {
          if (!world.player.alive) document.title = '\u00b7'
          else if (world.smoothKarma.beauty > 0.6) document.title = '\u2728\ud83c\udf3f'
          else if (world.smoothKarma.corruption > 0.5) document.title = '\u2728\ud83e\udea8'
          else document.title = '\u2728'
        }
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

  if (canvasFailed) {
    return (
      <div className="fixed inset-0 w-full h-full bg-[#050608] flex flex-col items-center justify-center gap-6">
        <nav className="flex gap-8">
          <a href="#/notes" className="text-gray-500/60 hover:text-cyan-400/40 transition-colors duration-500 text-sm font-mono tracking-widest">notes</a>
          <a href="#/artifacts" className="text-gray-500/60 hover:text-cyan-400/40 transition-colors duration-500 text-sm font-mono tracking-widest">artifacts</a>
          <a href="#/bio" className="text-gray-500/60 hover:text-cyan-400/40 transition-colors duration-500 text-sm font-mono tracking-widest">bio</a>
        </nav>
      </div>
    )
  }

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
  const cam = world.camera
  const karma = world.smoothKarma
  const starCount = world.starField.stars.length

  drawVoidBackground(ctx, w, h, karma, starCount)

  ctx.save()
  ctx.translate(-cam.x, -cam.y)

  drawStarField(ctx, world.starField, cam, w, h, world.time, world.scale)

  // Compute reachable leaves for visual feedback
  const reach = getReach(world.centipede)
  let reachableArr: number[] = []
  if (world.centipede.targetLeaf === -1) {
    if (world.centipede.currentLeaf >= 0) {
      // On a leaf: use neighbor-based reachable
      reachableArr = getReachableLeaves(world.tree, world.centipede.currentLeaf, reach)
    } else {
      // On ground or falling: scan all leaves within reach of head
      const headPos = getHeadPosition(world.centipede)
      for (let i = 0; i < world.tree.leaves.length; i++) {
        const l = world.tree.leaves[i]
        if (l.health <= 0) continue
        const dx = l.x - headPos.x
        const dy = l.y - headPos.y
        if (dx * dx + dy * dy <= reach * reach) {
          reachableArr.push(i)
        }
      }
    }
  }
  const reachableSet = new Set(reachableArr)

  drawTree(ctx, world.tree, cam, w, h, world.time, world.scale, reachableSet, world.centipede.currentLeaf)

  // Atmosphere fog overlay — after tree, before agents
  drawAtmosphere(ctx, w, h, cam, karma, starCount, world.time)

  drawAgents(ctx, world.agents, world.time, world.scale, cam, w, h)

  // Pot interaction visual — after agents, before player centipede
  if (world.pot.active) {
    const playerHead = getHeadPosition(world.centipede)
    const agent = world.agents.agents[world.pot.agentIndex]
    if (agent) {
      const agentHead = { x: agent.centipede.segments[0].x, y: agent.centipede.segments[0].y }
      drawPot(ctx, world.pot, playerHead, agentHead, world.time, world.scale)
    }
  }

  drawCentipede(ctx, world.centipede, world.time, world.scale, cam, w, h, true)

  ctx.restore()
}

function drawMuteGlyph(ctx: CanvasRenderingContext2D, w: number, h: number, muted: boolean, hovering: boolean) {
  const dpr = getDPR()
  const cx = w - 36 * dpr
  const cy = h - 36 * dpr
  const r = 10 * dpr
  const alpha = hovering ? 0.5 : 0.25

  ctx.save()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = `hsla(180, 50%, 70%, ${alpha})`
  ctx.lineWidth = 1.2 * dpr
  ctx.stroke()

  if (muted) {
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
    for (let i = 1; i <= 2; i++) {
      const arcR = r * 0.25 * i
      ctx.beginPath()
      ctx.arc(cx - r * 0.15, cy, arcR, -Math.PI * 0.35, Math.PI * 0.35)
      ctx.strokeStyle = `hsla(180, 50%, 70%, ${alpha * (1 - i * 0.25)})`
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(cx - r * 0.25, cy, 1.5 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(180, 50%, 70%, ${alpha})`
    ctx.fill()
  }

  ctx.restore()
}
