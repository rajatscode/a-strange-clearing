import type { CosmicMood } from '../lib/mood'

export type AudioParams = {
  mood: CosmicMood
  beauty: number
  trust: number
  hostility: number
  corruption: number
  playerEnergy: number
  playerAlive: boolean
  mouseSpeed: number
  isHovering: boolean
  clickEvent: boolean
  cleansing: boolean
}

// Pentatonic scale intervals (semitones from root)
const PENTATONIC = [0, 2, 4, 7, 9]
const MINOR_PENTATONIC = [0, 3, 5, 7, 10]

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12)
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private started = false
  private muted = false

  // Master
  private master: GainNode | null = null

  // Drone layer
  private droneOscs: OscillatorNode[] = []
  private droneGains: GainNode[] = []
  private droneFilter: BiquadFilterNode | null = null

  // Noise layer
  private noiseSource: AudioBufferSourceNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  private noiseGain: GainNode | null = null

  // Hover shimmer
  private shimmerOsc: OscillatorNode | null = null
  private shimmerGain: GainNode | null = null

  // Death filter
  private deathFilter: BiquadFilterNode | null = null

  // State tracking for delta checks
  private lastParams: Partial<AudioParams> = {}
  private chimeTimeout: ReturnType<typeof setTimeout> | null = null
  private disposed = false

  start(): void {
    if (this.started || this.disposed) return

    try {
      this.ctx = new AudioContext()
    } catch {
      return
    }

    this.started = true
    const ctx = this.ctx

    // Master gain
    this.master = ctx.createGain()
    this.master.gain.value = 0.2

    // Death filter (always in chain, starts open)
    this.deathFilter = ctx.createBiquadFilter()
    this.deathFilter.type = 'lowpass'
    this.deathFilter.frequency.value = 20000
    this.deathFilter.Q.value = 0.5

    this.master.connect(this.deathFilter)
    this.deathFilter.connect(ctx.destination)

    this.initDrone(ctx)
    this.initNoise(ctx)
    this.initShimmer(ctx)
    this.scheduleChime()
  }

  private initDrone(ctx: AudioContext): void {
    // 3 detuned oscillators through a shared low-pass filter
    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.frequency.value = 300
    this.droneFilter.Q.value = 1.5
    this.droneFilter.connect(this.master!)

    const baseFreq = 95
    const detunes = [0, 3, -4] // cents-ish via frequency offset

    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? 'sine' : i === 1 ? 'triangle' : 'sine'
      osc.frequency.value = baseFreq + detunes[i]

      const gain = ctx.createGain()
      gain.gain.value = i === 0 ? 0.12 : 0.06

      osc.connect(gain)
      gain.connect(this.droneFilter)
      osc.start()

      this.droneOscs.push(osc)
      this.droneGains.push(gain)
    }
  }

  private initNoise(ctx: AudioContext): void {
    // White noise buffer
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    this.noiseSource = ctx.createBufferSource()
    this.noiseSource.buffer = buffer
    this.noiseSource.loop = true

    this.noiseFilter = ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 800
    this.noiseFilter.Q.value = 2.0

    this.noiseGain = ctx.createGain()
    this.noiseGain.gain.value = 0.015

    this.noiseSource.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.master!)
    this.noiseSource.start()
  }

  private initShimmer(ctx: AudioContext): void {
    this.shimmerOsc = ctx.createOscillator()
    this.shimmerOsc.type = 'sine'
    this.shimmerOsc.frequency.value = 2400

    this.shimmerGain = ctx.createGain()
    this.shimmerGain.gain.value = 0

    this.shimmerOsc.connect(this.shimmerGain)
    this.shimmerGain.connect(this.master!)
    this.shimmerOsc.start()
  }

  private scheduleChime(): void {
    if (this.disposed || !this.ctx) return

    const beauty = this.lastParams.beauty ?? 0.5
    const hostility = this.lastParams.hostility ?? 0.1
    const trust = this.lastParams.trust ?? 0.5

    // Higher beauty/trust = more frequent chimes
    const baseInterval = 4000 + (1 - beauty) * 8000 + hostility * 6000
    const jitter = Math.random() * baseInterval * 0.6
    const interval = baseInterval + jitter

    this.chimeTimeout = setTimeout(() => {
      if (this.disposed || !this.ctx || this.muted) {
        this.scheduleChime()
        return
      }
      this.playChime(beauty, trust, hostility)
      this.scheduleChime()
    }, interval)
  }

  private playChime(beauty: number, trust: number, hostility: number): void {
    const ctx = this.ctx!
    const now = ctx.currentTime

    // Pick scale based on mood
    const scale = hostility > 0.5 ? MINOR_PENTATONIC : PENTATONIC
    const rootMidi = 72 // C5
    const interval = scale[Math.floor(Math.random() * scale.length)]
    const octaveShift = Math.random() < 0.3 ? 12 : 0
    const freq = midiToFreq(rootMidi + interval + octaveShift)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const gain = ctx.createGain()
    const volume = 0.03 + beauty * 0.04
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.02) // fast attack
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5 + trust * 1.5) // slow decay

    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(now)
    osc.stop(now + 3)

    // Cleanup after decay
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }

  private playClickBloom(cleansing: boolean): void {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const now = ctx.currentTime

    // Sine tone
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = cleansing ? 220 : 330

    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0, now)
    oscGain.gain.linearRampToValueAtTime(0.08, now + 0.01)
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)

    osc.connect(oscGain)
    oscGain.connect(this.master!)
    osc.start(now)
    osc.stop(now + 0.7)

    // Noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.15)
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize)
    }

    const nSrc = ctx.createBufferSource()
    nSrc.buffer = buf

    const nFilter = ctx.createBiquadFilter()
    nFilter.type = 'bandpass'
    nFilter.frequency.value = cleansing ? 600 : 1200
    nFilter.Q.value = 1.5

    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.04, now)
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)

    nSrc.connect(nFilter)
    nFilter.connect(nGain)
    nGain.connect(this.master!)
    nSrc.start(now)

    // Cleanup
    osc.onended = () => { osc.disconnect(); oscGain.disconnect() }
    nSrc.onended = () => { nSrc.disconnect(); nFilter.disconnect(); nGain.disconnect() }
  }

  update(params: AudioParams): void {
    if (!this.started || !this.ctx || this.disposed) return

    // Resume if suspended (autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    const ctx = this.ctx
    const now = ctx.currentTime
    const last = this.lastParams
    const DELTA = 0.01 // minimum change threshold

    // Click bloom
    if (params.clickEvent) {
      this.playClickBloom(params.cleansing)
    }

    // Drone: adjust filter cutoff and detuning based on mood
    if (this.droneFilter && (
      Math.abs((last.beauty ?? 0) - params.beauty) > DELTA ||
      Math.abs((last.corruption ?? 0) - params.corruption) > DELTA ||
      Math.abs((params.mood?.audioWarmth ?? 0) - (last.mood?.audioWarmth ?? 0)) > DELTA
    )) {
      const warmth = params.mood.audioWarmth
      const cutoff = 200 + warmth * 250 + params.beauty * 200 - params.corruption * 100
      this.droneFilter.frequency.setTargetAtTime(Math.max(100, cutoff), now, 0.5)

      // Increase detuning with corruption
      const detuneAmount = 3 + params.corruption * 15
      if (this.droneOscs[1]) {
        this.droneOscs[1].frequency.setTargetAtTime(95 + detuneAmount, now, 0.3)
      }
      if (this.droneOscs[2]) {
        this.droneOscs[2].frequency.setTargetAtTime(95 - detuneAmount * 1.2, now, 0.3)
      }

      // Volume responds to beauty
      for (let i = 0; i < this.droneGains.length; i++) {
        const baseVol = i === 0 ? 0.12 : 0.06
        const vol = baseVol * (0.6 + params.beauty * 0.6)
        this.droneGains[i].gain.setTargetAtTime(vol, now, 0.3)
      }
    }

    // Noise: adjust based on wind and corruption
    if (this.noiseFilter && this.noiseGain && (
      Math.abs((params.mood?.windStrength ?? 0) - (last.mood?.windStrength ?? 0)) > DELTA ||
      Math.abs((last.corruption ?? 0) - params.corruption) > DELTA
    )) {
      const windFreq = 600 + params.mood.windStrength * 800
      this.noiseFilter.frequency.setTargetAtTime(windFreq, now, 1.0)

      // Corruption widens bandwidth and increases volume
      const q = 2.5 - params.corruption * 1.8
      this.noiseFilter.Q.setTargetAtTime(Math.max(0.5, q), now, 0.5)

      const vol = 0.012 + params.corruption * 0.02 + params.mood.windStrength * 0.008
      this.noiseGain.gain.setTargetAtTime(vol, now, 0.5)
    }

    // Hover shimmer
    if (this.shimmerGain) {
      const targetShimmer = params.isHovering ? 0.025 : 0
      if (Math.abs(this.shimmerGain.gain.value - targetShimmer) > 0.005) {
        this.shimmerGain.gain.setTargetAtTime(targetShimmer, now, params.isHovering ? 0.3 : 0.8)
      }
    }

    // Death state: muffle everything
    if (this.deathFilter && this.master) {
      if (params.playerAlive !== last.playerAlive) {
        if (!params.playerAlive) {
          this.deathFilter.frequency.setTargetAtTime(400, now, 0.3)
          this.master.gain.setTargetAtTime(0.1, now, 0.3)
        } else {
          this.deathFilter.frequency.setTargetAtTime(20000, now, 2.0)
          this.master.gain.setTargetAtTime(0.2, now, 2.0)
        }
      }
    }

    // Master volume scales with energy
    if (this.master && Math.abs((last.playerEnergy ?? 1) - params.playerEnergy) > DELTA) {
      const vol = 0.15 + params.playerEnergy * 0.1
      if (params.playerAlive) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : vol, now, 0.5)
      }
    }

    // Store for delta checks
    this.lastParams = { ...params, mood: { ...params.mood } }
  }

  toggle(): void {
    if (!this.ctx || !this.master) return
    this.muted = !this.muted
    const now = this.ctx.currentTime
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.2, now, 0.3)
  }

  isMuted(): boolean {
    return this.muted
  }

  dispose(): void {
    this.disposed = true
    if (this.chimeTimeout) clearTimeout(this.chimeTimeout)

    for (const osc of this.droneOscs) {
      try { osc.stop(); osc.disconnect() } catch { /* already stopped */ }
    }
    if (this.noiseSource) {
      try { this.noiseSource.stop(); this.noiseSource.disconnect() } catch { /* */ }
    }
    if (this.shimmerOsc) {
      try { this.shimmerOsc.stop(); this.shimmerOsc.disconnect() } catch { /* */ }
    }

    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }

    this.started = false
  }
}
