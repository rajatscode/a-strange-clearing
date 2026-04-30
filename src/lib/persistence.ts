export type KarmaState = {
  beauty: number
  trust: number
  hostility: number
  navigability: number
  corruption: number
  playerEnergy: number
  generosity: number
  extraction: number
  patience: number
  totalVisits: number
  deaths: number
  lastVisit: number
}

const STORAGE_KEY = 'clearing-karma'

const DEFAULT_KARMA: KarmaState = {
  beauty: 0.6,
  trust: 0.5,
  hostility: 0.1,
  navigability: 0.5,
  corruption: 0.1,
  playerEnergy: 1.0,
  generosity: 0.3,
  extraction: 0.0,
  patience: 0.5,
  totalVisits: 0,
  deaths: 0,
  lastVisit: 0,
}

export function loadKarma(): KarmaState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const karma = { ...DEFAULT_KARMA, ...parsed }
      // Slow recovery over time — world heals between visits
      const hoursSinceVisit = (Date.now() - karma.lastVisit) / (1000 * 3600)
      if (hoursSinceVisit > 1) {
        const recovery = Math.min(hoursSinceVisit * 0.02, 0.3)
        karma.hostility = Math.max(0, karma.hostility - recovery)
        karma.corruption = Math.max(0, karma.corruption - recovery * 0.5)
        karma.beauty = Math.min(1, karma.beauty + recovery * 0.3)
        karma.trust = Math.min(1, karma.trust + recovery * 0.2)
      }
      // Always revive on page refresh — world remembers karma but player comes back alive
      if (karma.playerEnergy <= 0) {
        karma.playerEnergy = 0.5
      }
      karma.totalVisits++
      karma.lastVisit = Date.now()
      return karma
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_KARMA, totalVisits: 1, lastVisit: Date.now() }
}

export function saveKarma(karma: KarmaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(karma))
  } catch {
    // ignore storage errors
  }
}
