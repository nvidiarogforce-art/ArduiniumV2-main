/**
 * The click ripple: a Manhattan wavefront of lit cells spreading from wherever
 * the reader pressed.
 *
 * Propagation is 80ms per cell of distance and each cell lives 520ms with
 * `alpha = sin(progress · π)`, so a wave swells and fades rather than
 * switching. Only the ring of cells whose delay window overlaps the current
 * age is considered each frame, and the rAF loop parks itself when no wave is
 * alive — at rest this costs nothing.
 *
 * Callers own the canvas element and its stacking; this module never decides
 * where it sits. It must always be behind content (see `.ard-fx` in
 * globals.css for why).
 */
export type Ripple = {
  resize: () => void
  /** Viewport coordinates; ignored if they fall outside a local host. */
  at: (px: number, py: number) => void
  ambient: () => void
  destroy: () => void
}

const CELL = 46
const LIFE = 520
const STEP = 80

export function createRipple(
  canvas: HTMLCanvasElement,
  host: HTMLElement | null,
  opts: { outer: string; inner: string; alphaOuter: number; alphaInner: number },
): Ripple | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  let w = 0
  let h = 0
  let cols = 0
  let rows = 0
  let waves: Array<{ cx: number; cy: number; t0: number }> = []
  let running = false
  let dead = false

  const resize = () => {
    w = host ? host.clientWidth : window.innerWidth
    h = host ? host.clientHeight : window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cols = Math.ceil(w / CELL)
    rows = Math.ceil(h / CELL)
  }

  const frame = (now: number) => {
    if (dead) return
    ctx.clearRect(0, 0, w, h)
    let alive = false

    for (const wave of waves) {
      const age = now - wave.t0
      const dMin = Math.max(0, Math.floor((age - LIFE) / STEP))
      const dMax = Math.floor(age / STEP)
      if (dMax < 0 || dMin > cols + rows) continue
      alive = true

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const d = Math.abs(c - wave.cx) + Math.abs(r - wave.cy)
          if (d < dMin || d > dMax) continue
          const lt = age - d * STEP
          if (lt < 0 || lt > LIFE) continue
          const a = Math.sin((lt / LIFE) * Math.PI)
          if (a <= 0.01) continue
          const x = c * CELL
          const y = r * CELL
          ctx.fillStyle = opts.outer.replace('$', (a * opts.alphaOuter).toFixed(3))
          ctx.fillRect(x + 9, y + 9, CELL - 18, CELL - 18)
          ctx.fillStyle = opts.inner.replace('$', (a * opts.alphaInner).toFixed(3))
          ctx.fillRect(x + 17, y + 17, CELL - 34, CELL - 34)
        }
      }
    }

    waves = waves.filter((v) => now - v.t0 < LIFE + (cols + rows) * STEP)
    if (alive || waves.length) requestAnimationFrame(frame)
    else {
      running = false
      ctx.clearRect(0, 0, w, h)
    }
  }

  const cell = (cx: number, cy: number) => {
    if (dead) return
    waves.push({ cx, cy, t0: performance.now() })
    if (waves.length > 6) waves.shift()
    if (!running) {
      running = true
      requestAnimationFrame(frame)
    }
  }

  resize()

  return {
    resize,
    at(px, py) {
      let ox = 0
      let oy = 0
      if (host) {
        const r = host.getBoundingClientRect()
        if (px < r.left || px > r.right || py < r.top || py > r.bottom) return
        ox = r.left
        oy = r.top
      }
      cell(Math.floor((px - ox) / CELL), Math.floor((py - oy) / CELL))
    },
    ambient() {
      cell(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows))
    },
    destroy() {
      dead = true
      waves = []
    },
  }
}
