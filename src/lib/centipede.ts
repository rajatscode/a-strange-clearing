// Centipede physics — a creature that CRAWLS, REACHES, JUMPS, and FALLS
// All segments matter. Rear segments grip the surface, front segments reach toward the mouse.
// Length determines reach height. This IS the core mechanic.

import type { Tree } from './tree'

export type Segment = {
  x: number
  y: number
  prevX: number
  prevY: number
}

export type CentipedeState = 'crawling' | 'reaching' | 'jumping' | 'falling'

export type Centipede = {
  segments: Segment[]
  segmentSpacing: number
  maxSegments: number
  currentLeaf: number       // -1 = on ground
  targetLeaf: number        // used during jumping
  hopProgress: number
  hopDuration: number
  onGround: boolean
  fallVelocity: number
  state: CentipedeState
  direction: number         // 1 = facing right, -1 = facing left
  gripIndex: number         // in reaching state: index where grip meets lift
  jumpStartX: number        // jump origin
  jumpStartY: number
  lastLeaf: number          // leaf we just fell from (-1 = none) — prevents re-landing glitch
  lastLeafTimer: number     // cooldown before we can land on lastLeaf again
}

const SEG_SPACING = 12
const DEFAULT_COUNT = 12
const MAX_SEGMENTS = 80
const CRAWL_SPEED = 280        // px/s along surface
const REACH_THRESHOLD = 40     // screen px above surface before reaching starts
const JUMP_DURATION = 0.2      // seconds
const FALL_GRAVITY = 600       // px/s^2
const GRAB_RADIUS = 80         // px — how close head must be to leaf center to grab
const MIN_GRIP = 3             // minimum segments that must stay gripping

export function createCentipede(startX: number, startY: number, count: number = DEFAULT_COUNT): Centipede {
  const segments: Segment[] = []
  for (let i = 0; i < count; i++) {
    const x = startX - i * SEG_SPACING
    segments.push({ x, y: startY, prevX: x, prevY: startY })
  }
  return {
    segments, segmentSpacing: SEG_SPACING, maxSegments: MAX_SEGMENTS,
    currentLeaf: -1, targetLeaf: -1, hopProgress: 0, hopDuration: JUMP_DURATION,
    onGround: true, fallVelocity: 0, state: 'crawling' as CentipedeState, direction: 1,
    gripIndex: count - 1, jumpStartX: startX, jumpStartY: startY,
    lastLeaf: -1, lastLeafTimer: 0,
  }
}

export function getReach(c: Centipede): number {
  return c.segments.length * c.segmentSpacing
}

export function updateCentipede(
  c: Centipede, mouseScreenX: number, mouseScreenY: number,
  _vw: number, _vh: number, camX: number, camY: number,
  dt: number, tree: Tree,
): void {
  if (c.segments.length === 0) return
  const cdt = Math.min(dt, 0.05)
  const groundY = tree.originY
  const mouseWX = mouseScreenX + camX
  const mouseWY = mouseScreenY + camY

  // Get current surface Y
  const surfaceY = getSurfaceY(c, tree, groundY)

  if (c.state === 'falling') {
    updateFalling(c, tree, groundY, mouseWX, cdt)
    return
  }

  // CRAWLING or REACHING — we're on a surface
  const head = c.segments[0]

  // Use screen-space height: how far is the mouse above the centipede's surface on screen?
  const mouseScreenAboveSurface = (surfaceY - camY) - mouseScreenY // screen px above surface
  const isReaching = mouseScreenAboveSurface > REACH_THRESHOLD

  if (isReaching) {
    // --- REACHING: cobra stance ---
    c.state = 'reaching'

    // How many segments to lift based on screen distance
    const maxLiftable = c.segments.length - MIN_GRIP
    const segmentsToLift = Math.min(maxLiftable, Math.ceil(mouseScreenAboveSurface / (SEG_SPACING * 1.5)))
    c.gripIndex = Math.max(1, segmentsToLift)

    // Pivot: the segment where gripping meets lifting
    const pivotIdx = c.gripIndex
    const pivotSeg = c.segments[pivotIdx]

    // Gripping segments: crawl along surface toward mouse X (walk while reaching!)
    const gripMoveX = mouseWX - pivotSeg.x
    const gripMaxMove = CRAWL_SPEED * 0.5 * cdt // slower while reaching
    if (Math.abs(gripMoveX) > gripMaxMove) {
      pivotSeg.x += Math.sign(gripMoveX) * gripMaxMove
    }
    pivotSeg.y = surfaceY

    for (let i = pivotIdx + 1; i < c.segments.length; i++) {
      const leader = c.segments[i - 1]
      const seg = c.segments[i]
      seg.prevX = seg.x
      seg.prevY = seg.y
      const idealX = leader.x - SEG_SPACING * c.direction
      const follow = Math.min(1, 10 * cdt)
      seg.x += (idealX - seg.x) * follow
      seg.y = surfaceY
    }

    // Head target: mouse world position, capped by lift chain length from pivot
    const liftLen = c.gripIndex * SEG_SPACING
    const pToMx = mouseWX - pivotSeg.x
    const pToMy = mouseWY - pivotSeg.y
    const pToMd = Math.sqrt(pToMx ** 2 + pToMy ** 2)

    let headTX = mouseWX
    let headTY = mouseWY
    if (pToMd > liftLen) {
      headTX = pivotSeg.x + (pToMx / pToMd) * liftLen
      headTY = pivotSeg.y + (pToMy / pToMd) * liftLen
    }
    // Head can't go below surface
    headTY = Math.min(headTY, surfaceY)

    // Position lifted segments in a SMOOTH CURVE from pivot to head.
    // Use a cubic bezier: starts tangent to surface (horizontal), bends toward head.
    // Control point 1: extend horizontally from pivot in the reaching direction
    // Control point 2: head position
    const reachDir = headTX >= pivotSeg.x ? 1 : -1
    const cp1x = pivotSeg.x + reachDir * liftLen * 0.3
    const cp1y = surfaceY // tangent to surface
    const cp2x = headTX
    const cp2y = headTY

    for (let i = 0; i < c.gripIndex; i++) {
      const t = c.gripIndex > 0 ? (c.gripIndex - i) / c.gripIndex : 1 // 1=head, 0=pivot
      // Cubic bezier from pivot to head with smooth surface departure
      const inv = 1 - t
      const bx = inv*inv*inv * pivotSeg.x + 3*inv*inv*t * cp1x + 3*inv*t*t * cp2x + t*t*t * headTX
      const by = inv*inv*inv * surfaceY + 3*inv*inv*t * cp1y + 3*inv*t*t * cp2y + t*t*t * headTY
      c.segments[i].prevX = c.segments[i].x
      c.segments[i].prevY = c.segments[i].y
      c.segments[i].x = bx
      c.segments[i].y = by
    }

    // Direction tracks head
    if (headTX > pivotSeg.x + 5) c.direction = 1
    else if (headTX < pivotSeg.x - 5) c.direction = -1

    // Check if head reached a new leaf → grab it and start climbing
    // No teleporting — just switch anchor. Segments will follow naturally.
    for (let i = 0; i < tree.leaves.length; i++) {
      if (i === c.currentLeaf) continue
      const leaf = tree.leaves[i]
      if (leaf.health <= 0) continue
      const dist = Math.sqrt((head.x - leaf.x) ** 2 + (head.y - leaf.y) ** 2)
      if (dist < GRAB_RADIUS) {
        // Grab the new leaf — head is now on it, body follows naturally
        c.currentLeaf = i
        c.onGround = false
        c.state = 'crawling'
        // DON'T reposition segments — they'll climb up via the wave follow
        return
      }
    }
  } else {
    // --- CRAWLING ---
    c.state = 'crawling'
    c.gripIndex = c.segments.length - 1

    // Tick lastLeaf cooldown
    if (c.lastLeafTimer > 0) c.lastLeafTimer -= cdt
    if (c.lastLeafTimer <= 0) c.lastLeaf = -1

    // Move head toward mouse X along the surface
    const dx = mouseWX - head.x
    const maxMove = CRAWL_SPEED * cdt
    head.prevX = head.x
    head.prevY = head.y
    if (Math.abs(dx) > maxMove) {
      head.x += Math.sign(dx) * maxMove
    } else {
      head.x = mouseWX
    }
    // Only pin head to surface if it's horizontally on the leaf/ground
    if (c.currentLeaf >= 0) {
      const leaf = tree.leaves[c.currentLeaf]
      if (leaf) {
        const leafHalfW = leaf.size * 2
        if (head.x >= leaf.x - leafHalfW && head.x <= leaf.x + leafHalfW) {
          head.y = surfaceY
        } else {
          // Head is past the edge — apply gravity directly so it visibly droops
          head.y += FALL_GRAVITY * cdt * cdt
        }
      }
    } else {
      head.y = surfaceY // on ground, always pin
    }

    // Update direction
    if (dx > 2) c.direction = 1
    else if (dx < -2) c.direction = -1

    // Smooth wave crawl: each segment follows the one ahead
    // X follow is fast (responsive crawling), Y follow is slow (natural climbing)
    const followX = Math.min(1, 12 * cdt)  // fast horizontal
    const followY = Math.min(1, 3 * cdt)   // slow vertical — creates sequential climbing wave
    for (let i = 1; i < c.segments.length; i++) {
      const leader = c.segments[i - 1]
      const seg = c.segments[i]
      seg.prevX = seg.x
      seg.prevY = seg.y
      const idealX = leader.x - SEG_SPACING * c.direction
      seg.x += (idealX - seg.x) * followX
      seg.y += (leader.y - seg.y) * followY
    }

    // Soft surface attraction: segments near the leaf get PULLED toward surfaceY (not snapped)
    // This prevents fighting with the chain constraint
    if (c.currentLeaf >= 0) {
      const leaf = tree.leaves[c.currentLeaf]
      if (leaf) {
        const leafHalfW = leaf.size * 2
        let segmentsNearSurface = 0
        const surfacePull = Math.min(1, 15 * cdt) // strong but not instant

        for (let i = 0; i < c.segments.length; i++) {
          const seg = c.segments[i]
          const onLeafX = seg.x >= leaf.x - leafHalfW && seg.x <= leaf.x + leafHalfW

          if (onLeafX) {
            // Only pull toward surface if segment is already CLOSE (within 3 spacings)
            // This prevents yanking distant segments — they climb via the chain instead
            const distToSurface = Math.abs(seg.y - surfaceY)
            if (distToSurface < SEG_SPACING * 3) {
              seg.y += (surfaceY - seg.y) * surfacePull
              segmentsNearSurface++
            }
            // Segments further away are only moved by the chain follow — natural climbing
          } else {
            // Past the edge — real gravity pulls it down
            seg.y += FALL_GRAVITY * cdt * cdt * 0.5 // accelerating droop
            // Also pull toward a droop curve so it doesn't just freefall
            const overhang = Math.abs(seg.x - leaf.x) - leafHalfW
            const droopTarget = surfaceY + Math.max(overhang * 0.8, 10)
            if (seg.y < droopTarget) {
              seg.y += (droopTarget - seg.y) * surfacePull
            }
          }
        }

        // Fall when too few segments are near the surface
        if (segmentsNearSurface < MIN_GRIP) {
          c.lastLeaf = c.currentLeaf
          c.lastLeafTimer = 0.3
          c.state = 'falling'
          c.currentLeaf = -1
          c.onGround = false
          c.fallVelocity = 0
          return
        }
      }
    } else if (c.onGround) {
      // Ground: soft pull to groundY
      const groundPull = Math.min(1, 15 * cdt)
      for (let i = 0; i < c.segments.length; i++) {
        c.segments[i].y += (surfaceY - c.segments[i].y) * groundPull
      }
    }

    // FINAL: enforce segment spacing — hard X, soft Y when climbing
    for (let i = 1; i < c.segments.length; i++) {
      const leader = c.segments[i - 1]
      const seg = c.segments[i]
      const dx = seg.x - leader.x
      const dy = seg.y - leader.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > SEG_SPACING) {
        const ratio = SEG_SPACING / dist
        // Always enforce X spacing (no horizontal gaps)
        seg.x = leader.x + dx * ratio
        if (dy > SEG_SPACING * 0.5) {
          // Segment is BELOW leader (climbing up) — soft Y, let it climb gradually
          // Only pull Y gently so segments climb one-by-one
          seg.y += (leader.y + dy * ratio - seg.y) * 0.08
        } else {
          // Normal: segment is at same height or above leader — hard constraint
          seg.y = leader.y + dy * ratio
        }
      }
    }
  }
}

function getSurfaceY(c: Centipede, tree: Tree, groundY: number): number {
  if (c.currentLeaf >= 0) {
    const leaf = tree.leaves[c.currentLeaf]
    return leaf ? leaf.y : groundY
  }
  return groundY
}

// Kept for reference but no longer used — climbing is now segment-by-segment
export function _updateJumping(c: Centipede, tree: Tree, _groundY: number, dt: number): void {
  c.hopProgress += dt / c.hopDuration

  const targetLeaf = tree.leaves[c.targetLeaf]
  if (!targetLeaf) {
    c.state = 'falling'
    c.targetLeaf = -1
    c.fallVelocity = 0
    return
  }

  if (c.hopProgress >= 1) {
    // Landed! Lay flat on the new leaf
    c.currentLeaf = c.targetLeaf
    c.targetLeaf = -1
    c.hopProgress = 0
    c.onGround = false
    c.state = 'crawling'
    const leaf = targetLeaf
    for (let i = 0; i < c.segments.length; i++) {
      c.segments[i].x = leaf.x - i * SEG_SPACING * c.direction
      c.segments[i].y = leaf.y
      c.segments[i].prevX = c.segments[i].x
      c.segments[i].prevY = c.segments[i].y
    }
    return
  }

  // Arc all segments from start to target
  const t = c.hopProgress
  const easeT = t * t * (3 - 2 * t) // smooth ease in/out

  const tx = targetLeaf.x
  const ty = targetLeaf.y
  const sx = c.jumpStartX
  const sy = c.jumpStartY

  // Arc apex above both start and target
  const midX = (sx + tx) / 2
  const midY = Math.min(sy, ty) - 60

  // All segments follow bezier arc with decreasing progress (tail lags behind)
  for (let i = 0; i < c.segments.length; i++) {
    const segT = Math.max(0, easeT - i * 0.03) // each segment slightly behind
    const sInv = 1 - segT
    c.segments[i].prevX = c.segments[i].x
    c.segments[i].prevY = c.segments[i].y
    c.segments[i].x = sInv * sInv * sx + 2 * sInv * segT * midX + segT * segT * tx
    c.segments[i].y = sInv * sInv * sy + 2 * sInv * segT * midY + segT * segT * ty
    // Offset each segment slightly behind
    c.segments[i].x -= i * SEG_SPACING * 0.3 * (1 - easeT) * c.direction
  }
}

function updateFalling(c: Centipede, tree: Tree, groundY: number, mouseWX: number, dt: number): void {
  c.fallVelocity += FALL_GRAVITY * dt

  // Move all segments down
  for (const seg of c.segments) {
    seg.prevX = seg.x
    seg.prevY = seg.y
    seg.y += c.fallVelocity * dt
    // Slight horizontal drift toward mouse
    const drift = (mouseWX - seg.x) * 0.02
    seg.x += drift
  }

  // Check ground landing
  if (c.segments[0].y >= groundY) {
    c.state = 'crawling'
    c.onGround = true
    c.currentLeaf = -1
    c.fallVelocity = 0
    for (let i = 0; i < c.segments.length; i++) {
      c.segments[i].y = groundY
      c.segments[i].x = c.segments[0].x - i * SEG_SPACING * c.direction
    }
    return
  }

  // Tick lastLeaf cooldown during falling too
  if (c.lastLeafTimer > 0) c.lastLeafTimer -= dt
  if (c.lastLeafTimer <= 0) c.lastLeaf = -1

  // Check leaf landing (head hits a leaf) — skip the leaf we just fell from
  for (let i = 0; i < tree.leaves.length; i++) {
    if (i === c.lastLeaf) continue // don't re-land on leaf we just left
    const leaf = tree.leaves[i]
    if (leaf.health <= 0) continue
    const head = c.segments[0]
    const dist = Math.sqrt((head.x - leaf.x) ** 2 + (head.y - leaf.y) ** 2)
    if (dist < GRAB_RADIUS && c.fallVelocity > 0 && head.y >= leaf.y - 20) {
      // Land on this leaf
      c.state = 'crawling'
      c.currentLeaf = i
      c.onGround = false
      c.fallVelocity = 0
      for (let j = 0; j < c.segments.length; j++) {
        c.segments[j].y = leaf.y
        c.segments[j].x = leaf.x - j * SEG_SPACING * c.direction
      }
      return
    }
  }
}

export function addSegment(c: Centipede): boolean {
  if (c.segments.length >= c.maxSegments) return false
  const tail = c.segments[c.segments.length - 1]
  c.segments.push({
    x: tail.x - SEG_SPACING * c.direction,
    y: tail.y,
    prevX: tail.x - SEG_SPACING * c.direction,
    prevY: tail.y,
  })
  return true
}

export function getHeadPosition(c: Centipede): { x: number; y: number } {
  return { x: c.segments[0].x, y: c.segments[0].y }
}

export function getSegmentCount(c: Centipede): number {
  return c.segments.length
}
