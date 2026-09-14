/**
 * Sound, synthesised on the fly with the Web Audio API.
 *
 * No audio files are shipped — the same "everything is generated in code"
 * discipline as the 3D models. It also sidesteps the autoplay rules neatly:
 * the AudioContext is only created on the first real user gesture, and
 * everything before that is silently ignored.
 */

let ctx = null
let master = null
let motorOsc = null
let motorGain = null
let piezoOsc = null
let piezoGain = null
let lastAt = {}

function ensure() {
  if (ctx) return ctx
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  ctx = new AudioCtx()
  master = ctx.createGain()
  master.gain.value = 0.22
  master.connect(ctx.destination)
  return ctx
}

/** Call from any click handler; safe to call repeatedly. */
export function unlockAudio() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume()
}

/** Debounce so a fast loop can't machine-gun the same sound. */
function throttled(name, ms) {
  const now = performance.now()
  if (lastAt[name] && now - lastAt[name] < ms) return false
  lastAt[name] = now
  return true
}

function blip({ freq = 440, to = null, dur = 0.12, type = 'sine', gain = 0.5 }) {
  const c = ensure()
  if (!c || c.state === 'suspended') return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, c.currentTime + dur)
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
  osc.connect(g)
  g.connect(master)
  osc.start()
  osc.stop(c.currentTime + dur + 0.02)
}

export const sfx = {
  pick: () => throttled('pick', 60) && blip({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.35 }),
  /** the satisfying clink of a bolt going home */
  snap: () => throttled('snap', 80) && (blip({ freq: 880, to: 1320, dur: 0.1, type: 'square', gain: 0.22 }), blip({ freq: 300, dur: 0.14, type: 'sine', gain: 0.3 })),
  deny: () => throttled('deny', 150) && blip({ freq: 220, to: 160, dur: 0.18, type: 'sawtooth', gain: 0.2 }),
  chime: () => throttled('chime', 200) && ([0, 0.09, 0.18].forEach((d, i) => setTimeout(() => blip({ freq: [660, 880, 1174][i], dur: 0.18, type: 'sine', gain: 0.3 }), d * 1000))),
  error: () => throttled('error', 400) && blip({ freq: 200, to: 120, dur: 0.35, type: 'sawtooth', gain: 0.25 }),
  tick: () => throttled('tick', 120) && blip({ freq: 1200, dur: 0.04, type: 'sine', gain: 0.14 }),
  click: () => throttled('click', 40) && blip({ freq: 700, dur: 0.05, type: 'triangle', gain: 0.2 }),

  start: () => {
    sfx.chime()
  },

  /** A soft looping hum while any motor is turning. */
  motorOn: () => {
    const c = ensure()
    if (!c || c.state === 'suspended') return
    if (motorOsc) {
      motorGain.gain.setTargetAtTime(0.12, c.currentTime, 0.1)
      return
    }
    motorOsc = c.createOscillator()
    motorGain = c.createGain()
    motorOsc.type = 'sawtooth'
    motorOsc.frequency.value = 74
    motorGain.gain.value = 0.0001
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380
    motorOsc.connect(filter)
    filter.connect(motorGain)
    motorGain.connect(master)
    motorOsc.start()
    motorGain.gain.setTargetAtTime(0.12, c.currentTime, 0.15)
  },

  motorOff: () => {
    if (!ctx || !motorGain) return
    motorGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12)
  },

  /** Continuous tone from a correctly wired piezo output. */
  piezoOn: (frequency = 880) => {
    const c = ensure()
    if (!c || c.state === 'suspended') return
    if (!piezoOsc) {
      piezoOsc = c.createOscillator()
      piezoGain = c.createGain()
      piezoOsc.type = 'square'
      piezoGain.gain.value = 0.0001
      piezoOsc.connect(piezoGain)
      piezoGain.connect(master)
      piezoOsc.start()
    }
    piezoOsc.frequency.setTargetAtTime(Math.max(80, Math.min(2400, frequency)), c.currentTime, 0.02)
    piezoGain.gain.setTargetAtTime(0.045, c.currentTime, 0.025)
  },

  piezoOff: () => {
    if (!ctx || !piezoGain) return
    piezoGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.035)
  },

  stopAll: () => {
    sfx.motorOff()
    sfx.piezoOff()
  },
}
