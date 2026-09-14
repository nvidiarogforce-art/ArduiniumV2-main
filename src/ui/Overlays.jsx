import { useEffect, useRef, useState } from 'react'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { useT, partName } from '../i18n/index.js'
import { getMission } from '../lib/missions.js'
import { isElectronic as isElectronicKind, isMount as isMountKind } from '../lib/geometry.js'
import { motorConnection } from '../lib/circuits.js'
import { sfx, unlockAudio } from '../lib/sfx.js'
import { clearManualDrive, setManualDrive } from '../three/runtime.js'

/* --------------------------------------------------------------- run dock */

export function RunDock() {
  const running = useBuildStore((s) => s.running)
  const toggleRun = useBuildStore((s) => s.toggleRun)
  const parts = useBuildStore((s) => s.parts)
  const bolts = useBuildStore((s) => s.bolts)
  const wires = useBuildStore((s) => s.wires)
  const t = useT()

  const counts = Object.values(parts)
  // Count only wheels whose motor has a complete, powered L293D channel.
  // A single motor lead or an unpowered driver must never look drive-ready.
  const driven = counts.filter(
    (p) => p.kind === 'wheel' && parts[p.hostId]?.kind === 'motor'
      && motorConnection(parts[p.hostId], parts, wires).ready,
  ).length

  return (
    <div className="run-dock">
      <button
        className={running ? 'run-btn is-running' : 'run-btn'}
        data-testid="run"
        onClick={() => {
          unlockAudio()
          if (running) sfx.stopAll()
          toggleRun()
        }}
      >
        <span className="run-glyph">{running ? '■' : '▶'}</span>
        {running ? t('ui.stop') : t('ui.run')}
      </button>
      <span className="run-stat">
        <b>{counts.length}</b>
        {t('ui.statParts')}
      </span>
      <span className="run-stat">
        <b>{bolts.length}</b>
        {t('ui.statBolts')}
      </span>
      <span className="run-stat">
        <b>{driven}</b>
        {t('ui.statWheels')}
      </span>
    </div>
  )
}

/* ------------------------------------------------------- manual controller */

const REMOTE_KEYS = { w: 'forward', arrowup: 'forward', s: 'back', arrowdown: 'back', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' }

/** Momentary manual override. Releasing it hands control back to the program. */
export function ManualControlPad() {
  const running = useBuildStore((s) => s.running)
  const map = useUiStore((s) => s.map)
  const [speed, setSpeed] = useState(170)
  const [active, setActive] = useState(null)
  const held = useRef(new Set())
  const t = useT()
  const available = running && map !== 'circuitLab'

  const drive = (dir) => {
    setActive(dir)
    setManualDrive(dir, speed)
  }
  const stop = () => {
    setActive(null)
    clearManualDrive()
  }

  useEffect(() => {
    if (!available) {
      held.current.clear()
      stop()
      return undefined
    }
    const onDown = (event) => {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const key = event.key.toLowerCase()
      const dir = REMOTE_KEYS[key]
      if (!dir) return
      event.preventDefault()
      held.current.add(key)
      drive(dir)
    }
    const onUp = (event) => {
      const key = event.key.toLowerCase()
      if (!REMOTE_KEYS[key]) return
      event.preventDefault()
      held.current.delete(key)
      const fallback = [...held.current].at(-1)
      if (fallback) drive(REMOTE_KEYS[fallback])
      else stop()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      held.current.clear()
      clearManualDrive()
    }
  }, [available, speed])

  if (!available) return null
  const button = (dir, glyph, label) => (
    <button
      className={active === dir ? 'remote-key is-active' : 'remote-key'}
      data-drive={dir}
      aria-label={label}
      onPointerDown={(event) => { event.preventDefault(); drive(dir) }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onPointerLeave={() => { if (active === dir) stop() }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )

  return (
    <section className="remote-pad" aria-label={t('ui.remoteTitle')} data-testid="drive-remote">
      <div className="remote-head"><strong>{t('ui.remoteTitle')}</strong><span>W A S D</span></div>
      <div className="remote-grid">
        {button('forward', '▲', `${t('blocks.dirForward')} (W)`)}
        {button('left', '◀', `${t('blocks.dirLeft')} (A)`)}
        <button className="remote-key remote-stop" aria-label={t('ui.stop')} onClick={stop}>■</button>
        {button('right', '▶', `${t('blocks.dirRight')} (D)`)}
        {button('back', '▼', `${t('blocks.dirBack')} (S)`)}
      </div>
      <label className="remote-speed">
        <span>{t('ui.remoteSpeed')} <b>{speed}</b></span>
        <input type="range" min="80" max="255" step="5" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
      </label>
      <small>{t('ui.remoteHint')}</small>
    </section>
  )
}

/* ------------------------------------------------------- mission headline */

export function MissionBanner() {
  const mission = getMission(useUiStore((s) => s.mission))
  const progress = useUiStore((s) => s.missionProgress)
  const pending = useBuildStore((s) => s.pending)
  const t = useT()
  if (mission.kind === 'none' || pending) return null

  return (
    <div className="mission-banner">
      <span className="mission-icon">{mission.icon}</span>
      <span>
        <b>{t(`missions.${mission.id}.name`)}</b>
        <span>{t(`missions.${mission.id}.goal`)}</span>
        {progress.total > 0 && <em>{t('ui.missionProgress', progress)}</em>}
      </span>
    </div>
  )
}

export function MissionWin() {
  const won = useUiStore((s) => s.missionWon)
  const seconds = useUiStore((s) => s.missionSeconds)
  const dismiss = useUiStore((s) => s.dismissWin)
  const mission = getMission(useUiStore((s) => s.mission))
  const t = useT()
  if (!won) return null

  return (
    <div className="overlay">
      <div className="sheet win-sheet">
        <div className="big">🏆</div>
        <h2>{t('ui.missionDone')}</h2>
        <p>
          {t('lessons.missionDone.body', {
            name: t(`missions.${mission.id}.name`),
            seconds,
          })}
        </p>
        <div className="sheet-actions">
          <button className="primary" onClick={dismiss}>
            {t('ui.keepPlaying')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- carry banner */

export function CarryBanner() {
  const pending = useBuildStore((s) => s.pending)
  const cancel = useBuildStore((s) => s.cancelPlace)
  const rotate = useBuildStore((s) => s.rotatePending)
  const lift = useBuildStore((s) => s.liftPending)
  const t = useT()
  if (!pending) return null

  const flat = !isMountKind(pending.kind) && !isElectronicKind(pending.kind)

  return (
    <div className="carry-banner">
      <span>{t('ui.holding', { part: partName(pending.kind) })}</span>
      {/* Explicit direction: passing the handler straight to onClick handed it
          the click event, and event * ROTATION_STEP is NaN — which then rode
          into the committed part's rotY. */}
      <button onClick={() => rotate(1, 'y')}>
        <kbd>R</kbd> {t('ui.kbdTurn')}
      </button>
      {flat && (
        <>
          <button onClick={() => rotate(1, 'x')}>
            <kbd>T</kbd> {t('ui.kbdTilt')}
          </button>
          <button onClick={() => rotate(1, 'z')}>
            <kbd>F</kbd> {t('ui.kbdRoll')}
          </button>
          <button onClick={() => lift(1)}>
            <kbd>E</kbd> {t('ui.kbdRaise')}
          </button>
          <button onClick={() => lift(-1)}>
            <kbd>Q</kbd> {t('ui.kbdLower')}
          </button>
        </>
      )}
      <button onClick={cancel}>
        <kbd>Esc</kbd> {t('ui.kbdCancel')}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ toasts */

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((x) => (
        <div key={x.id} className={`toast ${x.tone}`}>
          {x.tone === 'good' ? '✅' : x.tone === 'warn' ? '⚠️' : 'ℹ️'} {x.text}
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- onboarding */

export function Onboarding() {
  const step = useUiStore((s) => s.onboardingStep)
  const next = useUiStore((s) => s.nextOnboarding)
  const skip = useUiStore((s) => s.skipOnboarding)
  const t = useT()
  const steps = t('onboarding')
  if (step > steps.length - 1) return null
  const s = steps[step]

  return (
    <div className="overlay">
      <div className="sheet">
        <div className="big">{s.icon}</div>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div className="dots">
          {steps.map((_, i) => (
            <span key={i} className={i === step ? 'dot is-on' : 'dot'} />
          ))}
        </div>
        <div className="sheet-actions">
          <button className="btn" onClick={skip} data-testid="skip-onboarding">
            {t('ui.skip')}
          </button>
          <button
            className="primary"
            data-testid="onboarding-next"
            onClick={() => {
              unlockAudio()
              sfx.click()
              next()
            }}
          >
            {step === steps.length - 1 ? t('ui.startBuilding') : t('ui.next')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- help */

export function HelpSheet() {
  const open = useUiStore((s) => s.helpOpen)
  const setOpen = useUiStore((s) => s.setHelpOpen)
  const t = useT()
  if (!open) return null
  const rows = t('helpRows')

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left' }}>
        <h2 style={{ textAlign: 'center' }}>{t('ui.helpTitle')}</h2>
        <div className="help-grid">
          {rows.map(([n, bold, rest], i) => (
            <div className="help-row" key={i}>
              <b>{n}</b>
              <span>
                <b>{bold}</b> {rest}
              </span>
            </div>
          ))}
        </div>
        <div className="sheet-actions">
          <button className="primary" onClick={() => setOpen(false)}>
            {t('ui.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
