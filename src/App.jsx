import { useEffect } from 'react'
import Scene from './three/Scene.jsx'
import PartsPanel from './ui/PartsPanel.jsx'
import TopBar from './ui/TopBar.jsx'
import LearningRail from './ui/LearningRail.jsx'
import WorkshopGuide from './ui/WorkshopGuide.jsx'
import Dock from './ui/Dock.jsx'
import ModeRail from './ui/ModeRail.jsx'
import {
  RunDock,
  CarryBanner,
  Toasts,
  Onboarding,
  HelpSheet,
  MissionBanner,
  MissionWin,
  ManualControlPad,
} from './ui/Overlays.jsx'
import { useBuildStore } from './store/useBuildStore.js'
import { useUiStore } from './store/useUiStore.js'
import { useT } from './i18n/index.js'
import { rt } from './three/runtime.js'
import { terminalWorld } from './lib/terminals.js'
import { candidateNodes, partTransform } from './lib/geometry.js'
import { PITCH } from './lib/config.js'

/** Width a drawer takes from the scene, open and closed. */
const DRAWER_W = { left: [302, 46], right: [332, 46] }

export default function App() {
  const teach = useUiStore((s) => s.teach)
  const leftOpen = useUiStore((s) => s.drawers.left)
  const rightOpen = useUiStore((s) => s.drawers.right)

  // The bottom drawer tucks between the side drawers instead of sliding under
  // them, so opening a panel never hides the blocks the student is editing.
  const gutters = {
    '--gutter-left': `${DRAWER_W.left[leftOpen ? 0 : 1] + 82}px`,
    '--gutter-right': `${DRAWER_W.right[rightOpen ? 0 : 1] + 16}px`,
  }

  // Keyboard shortcuts. Deliberately few, and all of them are printed
  // somewhere on screen — a 10-year-old should never need to memorise any.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const build = useBuildStore.getState()

      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z') {
        e.preventDefault()
        // Ctrl+Shift+Z is the second redo binding, alongside Ctrl+Y.
        if (e.shiftKey) build.redo()
        else build.undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        build.redo()
      } else if (e.key === 'Escape') {
        // Escape backs out of whatever gesture is live. A wire drag is checked
        // first: if one is in flight it is the thing on screen following the
        // cursor, so it is what the student means to abandon.
        if (build.wiring) build.cancelWire()
        else build.cancelPlace()
      }
      else if ((key === 'r' || key === 't' || key === 'f') && !mod) {
        // R yaws, T pitches (world X), F rolls (world Z) — a quarter turn
        // each, Shift for the other way. They act on whatever you are
        // holding; with nothing in hand they turn the part you have selected,
        // so a build can be adjusted without picking it up and losing its
        // bolts. The !mod guard keeps Ctrl+R the browser reload it is.
        const dir = e.shiftKey ? -1 : 1
        const axis = key === 'r' ? 'y' : key === 't' ? 'x' : 'z'
        if (build.pending) build.rotatePending(dir, axis)
        else if (build.selected) build.rotatePart(build.selected, dir, axis)
      } else if ((key === 'e' || key === 'q') && !mod && build.pending) {
        // E lifts the carried part half a hole, Q lowers it — free height.
        build.liftPending(key === 'e' ? 1 : -1)
      } else if (e.key.startsWith('Arrow') && build.selected && !build.pending) {
        // Arrow keys walk a placed part across the grid one hole at a time,
        // in world axes; PageUp/PageDown (below) move it vertically.
        e.preventDefault()
        // Mapped for the default camera (looking in from +X/+Z): Up walks the
        // part away from you, Right walks it to the right.
        const step = {
          ArrowUp: [0, 0, -PITCH],
          ArrowDown: [0, 0, PITCH],
          ArrowLeft: [-PITCH, 0, 0],
          ArrowRight: [PITCH, 0, 0],
        }[e.key]
        if (step) build.nudgePart(build.selected, step)
      } else if ((e.key === 'PageUp' || e.key === 'PageDown') && build.selected && !build.pending) {
        e.preventDefault()
        build.nudgePart(build.selected, [0, e.key === 'PageUp' ? PITCH / 2 : -PITCH / 2, 0])
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && build.selected)
        build.deletePart(build.selected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    teach('welcome', {})
    // Expose a little state for the automated smoke test.
    window.__ARDUINIUM_LOAD__ = (json) => useBuildStore.getState().loadBuildFromJSON(json, 'test')
    window.__ARDUINIUM_RUN__ = () => useBuildStore.getState().toggleRun()
    window.__ARDUINIUM_SETPROG__ = (p) => useBuildStore.getState().setProgram(p)
    window.__ARDUINIUM_PROG__ = () => useBuildStore.getState().program
    window.__ARDUINIUM_UI__ = () => useUiStore.getState()
    window.__ARDUINIUM_RT__ = () => rt
    window.__ARDUINIUM_PARTS__ = () => useBuildStore.getState().parts
    // Whole build store, for the editing harness in tools/edit-test.mjs.
    window.__ARDUINIUM_BUILD__ = () => useBuildStore.getState()
    /**
     * A terminal's world position, for the pointer-drag harness.
     *
     * terminalWorld gives build space; the whole build is rendered inside a
     * group lifted by buildLift(), so the lift has to be added to get the
     * point the camera actually projects.
     */
    window.__ARDUINIUM_TERMINAL__ = (partId, terminalId) => {
      const b = useBuildStore.getState()
      const part = b.parts[partId]
      if (!part) return null
      const p = terminalWorld(part, terminalId, b.parts)
      return p ? [p[0], p[1] + b.buildLift(), p[2]] : null
    }
    /**
     * A part's resolved world transform, and every node a kind may snap to.
     *
     * The mount harness needs both: a fitting's position is derived from its
     * whole chain rather than stored, so `parts[id].pos` is undefined for
     * anything mounted, and "which hole did that land on" is only answerable
     * against the node list the snap matrix actually produced.
     */
    window.__ARDUINIUM_XFORM__ = (partId) => {
      const b = useBuildStore.getState()
      return partTransform(b.parts[partId], b.parts)
    }
    window.__ARDUINIUM_NODES__ = (kind) => {
      const b = useBuildStore.getState()
      return candidateNodes(kind, b.parts, b.isNodeTaken)
    }
    window.__ARDUINIUM__ = () => {
      const b = useBuildStore.getState()
      const u = useUiStore.getState()
      return {
        parts: b.order.length,
        bolts: b.bolts.length,
        running: b.running,
        pinMap: b.pinMap(),
        serial: b.serial.length,
        lessons: u.log.length,
        lastLesson: u.lastLesson?.key ?? null,
        mission: u.mission,
        map: u.map,
        missionProgress: u.missionProgress,
        missionWon: u.missionWon,
        quality: u.quality,
        robotPos: rt.robotPos,
        distance: rt.distance,
        motorSpeed: rt.motorSpeed,
        manualDrive: rt.manualDrive,
      }
    }
  }, [teach])

  return (
    <div className="app" style={gutters}>
      {/* The 3D view owns the whole window. Everything else floats on top of
          it and slides out of the way, so the build is always the biggest
          thing on screen — the single change that makes this read as a tool
          rather than a web page with a viewport bolted into it. */}
      <div className="stage-wrap">
        <Scene />
      </div>

      <TopBar />
      <ModeRail />
      <MissionBanner />
      <CarryBanner />
      <RunDock />
      <ManualControlPad />

      <Drawer side="left" icon="🧱" labelKey="drawerParts">
        <PartsPanel />
      </Drawer>
      <Drawer side="right" icon="🧠" labelKey="drawerInfo">
        <LearningRail />
      </Drawer>
      <Drawer side="bottom" icon="🧩" labelKey="drawerCode">
        <Dock />
      </Drawer>

      <Toasts />
      <Onboarding />
      <HelpSheet />
      <MissionWin />
      <WorkshopGuide />
    </div>
  )
}

/**
 * A sliding panel with a permanently visible tab.
 *
 * Closed, it leaves only its handle on screen; open, it overlays the scene.
 * The handle never moves out of reach, so nothing is ever "lost" — important
 * when the person using this is ten years old and has just accidentally
 * collapsed the panel they were reading.
 */
function Drawer({ side, icon, labelKey, children }) {
  const open = useUiStore((s) => s.drawers[side])
  const toggle = useUiStore((s) => s.toggleDrawer)
  const t = useT()
  const arrow = { left: open ? '‹' : '›', right: open ? '›' : '‹', bottom: open ? '▾' : '▴' }[side]

  return (
    <div className={`drawer drawer-${side} ${open ? 'is-open' : 'is-closed'}`} data-drawer={side}>
      <button
        className="drawer-handle"
        onClick={() => toggle(side)}
        aria-expanded={open}
        data-drawer-toggle={side}
        title={t(`ui.${labelKey}`)}
      >
        <span className="drawer-handle-icon">{icon}</span>
        <span className="drawer-handle-text">{t(`ui.${labelKey}`)}</span>
        <span className="drawer-handle-arrow">{arrow}</span>
      </button>
      <div className="drawer-panel">{children}</div>
    </div>
  )
}
