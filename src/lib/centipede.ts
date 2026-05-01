// Centipede physics — caterpillar-style crawling with gravity and platform collision
//
// Two movement modes, determined by mouse position:
//   CRAWLING: head moves horizontally along the surface, body follows in a wave
//   REACHING: head lifts off surface toward mouse, body shifts weight backward
//
// Grounded segments slide along surfaces with a soft spring (caterpillar wave).
// Airborne segments drape from their leader with a gravity bias (natural hang).

import type { Tree, Leaf } from './tree'

export type Segment = {
  x: number
  y: number
  prevX: number
  prevY: number
}

export type CentipedeState = 'crawling' | 'reaching' | 'falling'

export type Centipede = {
  segments: Segment[]
  segmentSpacing: number
  maxSegments: number
  currentLeaf: number
  onGround: boolean
  state: CentipedeState
  direction: number
}

const SEG_SPACING = 12
const DEFAULT_COUNT = 12
const MAX_SEGMENTS = 80
const CRAWL_SPEED = 350        // px/s — snappy head tracking
const GRAVITY = 800            // px/s² — head gravity when falling
const DAMPING = 0.97           // verlet damping (head only, when falling)
const SURFACE_SNAP = 10        // px tolerance for landing on platforms
const REACH_THRESHOLD = 40     // px above surface to trigger reaching
const CRAWL_FOLLOW = 30        // follow rate/s — fast and smooth
const DRAPE_BIAS = SEG_SPACING * 0.7  // downward bias for airborne segments
const CHAIN_TAUT = SEG_SPACING * 1.5  // max chain slack before segment lifts off

export function createCentipede(startX: number, startY: number, count: number = DEFAULT_COUNT): Centipede {
  const segments: Segment[] = []
  for (let i = 0; i < count; i++) {
    const x = startX - i * SEG_SPACING
    segments.push({ x, y: startY, prevX: x, prevY: startY })
  }
  return {
    segments, segmentSpacing: SEG_SPACING, maxSegments: MAX_SEGMENTS,
    currentLeaf: -1, onGround: true, state: 'crawling', direction: 1,
  }
}

export function getReach(c: Centipede): number {
  return c.segments.length * c.segmentSpacing
}

// ─── Per-segment surface cache (computed once, reused everywhere) ───
type SurfaceHit = { y: number; leafIdx: number } | null

function probeSurface(x: number, y: number, leaves: Leaf[], groundY: number): SurfaceHit {
  // Check ground first (cheapest)
  if (y >= groundY - SURFACE_SNAP) return { y: groundY, leafIdx: -1 }

  // Find closest leaf surface at this X
  let bestY: number | null = null
  let bestDist = Infinity
  let bestIdx = -1

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]
    if (leaf.health <= 0) continue
    const hw = leaf.size * 2
    if (x >= leaf.x - hw && x <= leaf.x + hw) {
      const dist = Math.abs(y - leaf.y)
      if (dist < SURFACE_SNAP && dist < bestDist) {
        bestDist = dist
        bestY = leaf.y
        bestIdx = i
      }
    }
  }

  return bestY !== null ? { y: bestY, leafIdx: bestIdx } : null
}

function snapDown(x: number, y: number, leaves: Leaf[], groundY: number): SurfaceHit {
  // Like probeSurface but for landing — checks if segment is at/below a surface
  let bestY = Infinity
  let bestIdx = -1

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]
    if (leaf.health <= 0) continue
    const hw = leaf.size * 2
    if (x >= leaf.x - hw && x <= leaf.x + hw) {
      if (y >= leaf.y - SURFACE_SNAP && y <= leaf.y + SEG_SPACING) {
        if (leaf.y < bestY) { bestY = leaf.y; bestIdx = i }
      }
    }
  }

  if (bestY < Infinity) return { y: bestY, leafIdx: bestIdx }
  if (y >= groundY) return { y: groundY, leafIdx: -1 }
  return null
}

export function updateCentipede(
  c: Centipede, mouseScreenX: number, mouseScreenY: number,
  _vw: number, _vh: number, camX: number, camY: number,
  dt: number, tree: Tree, godMode: boolean = false,
): void {
  if (c.segments.length === 0) return

  // GOD MODE: head flies freely to mouse, body drapes behind. No surface constraints.
  if (godMode) {
    const cdt = Math.min(dt, 0.05)
    const mouseWX = mouseScreenX + camX
    const mouseWY = mouseScreenY + camY
    const head = c.segments[0]
    const maxMove = 600 * cdt // fast flight
    const hdx = mouseWX - head.x, hdy = mouseWY - head.y
    const hdist = Math.sqrt(hdx * hdx + hdy * hdy)
    head.prevX = head.x; head.prevY = head.y
    if (hdist > maxMove) {
      head.x += (hdx / hdist) * maxMove
      head.y += (hdy / hdist) * maxMove
    } else { head.x = mouseWX; head.y = mouseWY }
    if (hdx > 2) c.direction = 1; else if (hdx < -2) c.direction = -1
    // Body drapes behind head
    const DRAPE = c.segmentSpacing * 0.7
    for (let i = 1; i < c.segments.length; i++) {
      const leader = c.segments[i - 1], seg = c.segments[i]
      seg.prevX = seg.x; seg.prevY = seg.y
      let dx = seg.x - leader.x, dy = seg.y - leader.y + DRAPE
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0.001) {
        seg.x = leader.x + (dx / dist) * c.segmentSpacing
        seg.y = leader.y + (dy / dist) * c.segmentSpacing
      }
    }
    c.state = 'crawling'; c.currentLeaf = -1; c.onGround = false
    return
  }

  const cdt = Math.min(dt, 0.05)
  const groundY = tree.originY
  const mouseWX = mouseScreenX + camX
  const mouseWY = mouseScreenY + camY
  const head = c.segments[0]
  const wasGrounded = c.state !== 'falling'
  const leaves = tree.leaves

  const hdx = mouseWX - head.x
  const hdy = mouseWY - head.y

  // ─── Step 1: Head movement ───
  if (!wasGrounded) {
    // FALLING: verlet gravity + mouse steering (velocity preserved from prev frame)
    const hvx = (head.x - head.prevX) * DAMPING
    const hvy = (head.y - head.prevY) * DAMPING
    head.prevX = head.x
    head.prevY = head.y
    const hdist = Math.sqrt(hdx * hdx + hdy * hdy)
    const steer = Math.min(CRAWL_SPEED * 0.3 * cdt, hdist)
    head.x += hvx + (hdist > 1 ? (hdx / hdist) * steer : 0)
    head.y += hvy + GRAVITY * cdt * cdt
  } else {
    const headSurf = probeSurface(head.x, head.y, leaves, groundY)
    const mouseAbove = headSurf !== null ? headSurf.y - mouseWY : Infinity

    head.prevX = head.x
    head.prevY = head.y

    if (headSurf !== null && mouseAbove <= REACH_THRESHOLD) {
      // CRAWLING: horizontal only, pin to surface
      const maxMove = CRAWL_SPEED * cdt
      if (Math.abs(hdx) > maxMove) head.x += Math.sign(hdx) * maxMove
      else head.x = mouseWX
      // Pin to surface at new X
      const newSurf = probeSurface(head.x, head.y, leaves, groundY)
      if (newSurf !== null) head.y = newSurf.y
    } else {
      // REACHING: track mouse in 2D
      const maxMove = CRAWL_SPEED * cdt
      const hdist = Math.sqrt(hdx * hdx + hdy * hdy)
      if (hdist > maxMove) {
        head.x += (hdx / hdist) * maxMove
        head.y += (hdy / hdist) * maxMove
      } else {
        head.x = mouseWX
        head.y = mouseWY
      }
    }
  }

  if (hdx > 2) c.direction = 1
  else if (hdx < -2) c.direction = -1

  // ─── Step 2: Body segments ───
  const followRate = Math.min(1, CRAWL_FOLLOW * cdt)

  // Also track first gripped segment and currentLeaf in this single pass
  let gripIdx = -1
  let foundLeaf = -1

  // Check head surface for state
  const headCheck = probeSurface(head.x, head.y, leaves, groundY)
  if (headCheck !== null) {
    gripIdx = 0
    foundLeaf = headCheck.leafIdx
  }

  for (let i = 1; i < c.segments.length; i++) {
    const leader = c.segments[i - 1]
    const seg = c.segments[i]

    // Single surface probe for this segment
    const surf = probeSurface(seg.x, seg.y, leaves, groundY)

    // Can chain reach this surface from leader?
    let grounded = false
    if (surf !== null) {
      const dxL = leader.x - seg.x
      const dyL = leader.y - surf.y
      const chainDist = Math.sqrt(dxL * dxL + dyL * dyL)
      grounded = chainDist <= CHAIN_TAUT
    }

    seg.prevX = seg.x
    seg.prevY = seg.y

    if (grounded && surf !== null) {
      // GROUNDED: slide along surface with soft follow
      const idealX = leader.x - SEG_SPACING * c.direction
      seg.x += (idealX - seg.x) * followRate
      seg.y = surf.y

      // Track grip and leaf
      if (gripIdx === -1) gripIdx = i
      if (foundLeaf === -1) foundLeaf = surf.leafIdx
    } else {
      // AIRBORNE: drape from leader with gravity bias
      let dx = seg.x - leader.x
      let dy = seg.y - leader.y + DRAPE_BIAS

      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0.001) {
        seg.x = leader.x + (dx / dist) * SEG_SPACING
        seg.y = leader.y + (dy / dist) * SEG_SPACING
      }

      // Check landing
      const landing = snapDown(seg.x, seg.y, leaves, groundY)
      if (landing !== null) {
        seg.y = landing.y
        seg.prevY = seg.y
        if (gripIdx === -1) gripIdx = i
        if (foundLeaf === -1) foundLeaf = landing.leafIdx
      }
    }
  }

  // ─── Step 3: Derive state (no extra leaf scans needed) ───
  c.currentLeaf = foundLeaf
  c.onGround = head.y >= groundY - 3
  c.state = gripIdx < 0 ? 'falling' : gripIdx > 0 ? 'reaching' : 'crawling'
}

// ─── Public helpers ───

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

/** Add a segment in the MIDDLE of the centipede (not at tail). Returns true if added. */
export function addMiddleSegment(c: Centipede): boolean {
  if (c.segments.length >= c.maxSegments) return false
  if (c.segments.length < 2) return addSegment(c)

  const mid = Math.floor(c.segments.length / 2)
  const before = c.segments[mid - 1]
  const after = c.segments[mid]
  const newSeg: Segment = {
    x: (before.x + after.x) / 2,
    y: (before.y + after.y) / 2,
    prevX: (before.prevX + after.prevX) / 2,
    prevY: (before.prevY + after.prevY) / 2,
  }
  c.segments.splice(mid, 0, newSeg)
  return true
}

/** Remove a segment from the MIDDLE. Returns true if removed. Minimum 2 segments.
 *  Re-settles neighbors to close the gap so there's no visual break. */
export function removeMiddleSegment(c: Centipede): boolean {
  if (c.segments.length <= 2) return false
  const mid = Math.floor(c.segments.length / 2)
  c.segments.splice(mid, 1)

  // Close the gap: pull segments toward each other from the splice point
  if (mid > 0 && mid < c.segments.length) {
    const before = c.segments[mid - 1]
    const after = c.segments[mid]
    // Move both toward each other's midpoint
    const mx = (before.x + after.x) / 2
    const my = (before.y + after.y) / 2
    after.x = mx + (after.x - mx) * 0.5
    after.y = my + (after.y - my) * 0.5
    after.prevX = after.x
    after.prevY = after.y
    before.x = mx + (before.x - mx) * 0.5
    before.y = my + (before.y - my) * 0.5
    before.prevX = before.x
    before.prevY = before.y

    // Cascade: re-settle the rest of the chain from the splice point outward
    for (let i = mid + 1; i < c.segments.length; i++) {
      const leader = c.segments[i - 1]
      const seg = c.segments[i]
      const dx = seg.x - leader.x, dy = seg.y - leader.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > c.segmentSpacing * 1.5) {
        const scale = c.segmentSpacing / dist
        seg.x = leader.x + dx * scale
        seg.y = leader.y + dy * scale
        seg.prevX = seg.x
        seg.prevY = seg.y
      }
    }
  }

  return true
}
