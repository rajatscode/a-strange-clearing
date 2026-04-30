// Agent rendering — reuses drawCentipede for each NPC agent
// All agents look visually similar (identity revealed through behavior, not appearance)

import type { AgentSystem } from './agents'
import { drawCentipede } from './render-centipede'

type Camera = { x: number; y: number }

export function drawAgents(
  ctx: CanvasRenderingContext2D,
  system: AgentSystem,
  time: number,
  scale: number,
  cam: Camera,
  vpW: number,
  vpH: number,
): void {
  for (const agent of system.agents) {
    drawCentipede(ctx, agent.centipede, time, scale, cam, vpW, vpH)
  }
}
