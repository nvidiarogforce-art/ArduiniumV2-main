import { create } from 'zustand'
import { t } from '../i18n/index.js'
import { getMap } from '../lib/maps.js'
import { getMission } from '../lib/missions.js'

let logSeq = 0
let toastSeq = 0

/**
 * Everything about the *interface* — panels, camera intent, the learning log,
 * toasts, X-ray. Kept separate from the build state so that opening a panel
 * never invalidates anything the 3D scene cares about.
 */
export const useUiStore = create((set, get) => ({
  // ------------------------------------------------------------------ panels
  partsTab: 'electronics', // 'electronics' | 'structure'
  dockTab: 'program', // 'program' | 'serial'
  dockOpen: true,
  xray: false,
  onboardingStep: 0, // 0..2, 3 = finished
  helpOpen: false,

  /**
   * The three sliding drawers. The 3D view owns the entire window; panels sit
   * on top of it and get out of the way the moment you start building, which is
   * the difference between "a web page with a viewport in it" and something
   * that feels like a real tool.
   */
  workflowMode: 'build',
  drawers: { left: true, right: false, bottom: false },
  setWorkflowMode: (workflowMode) => {
    const layouts = {
      build: { left: true, right: false, bottom: false },
      circuit: { left: true, right: false, bottom: false },
      code: { left: false, right: false, bottom: true },
      simulate: { left: false, right: false, bottom: false },
    }
    if (!Object.hasOwn(layouts, workflowMode)) return
    set((state) => ({
      workflowMode,
      wireMode: workflowMode === 'circuit',
      partsTab: workflowMode === 'circuit' ? 'components' : state.partsTab,
      dockTab: workflowMode === 'code' ? state.dockTab : state.dockTab,
      drawers: layouts[workflowMode],
    }))
  },
  setDrawer: (side, open) =>
    set((s) => ({
      drawers: { ...s.drawers, [side]: typeof open === 'boolean' ? open : !s.drawers[side] },
    })),
  toggleDrawer: (side) => set((s) => ({ drawers: { ...s.drawers, [side]: !s.drawers[side] } })),
  soloView: () => set({ drawers: { left: false, right: false, bottom: false } }),

  setPartsTab: (partsTab) => set({ partsTab }),
  setDockTab: (dockTab) =>
    set((s) => ({ workflowMode: 'code', wireMode: false, dockTab, dockOpen: true, drawers: { left: false, right: false, bottom: true } })),
  toggleDock: () =>
    set((s) => ({ dockOpen: !s.dockOpen, drawers: { ...s.drawers, bottom: !s.dockOpen } })),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  nextOnboarding: () => set((s) => ({ onboardingStep: s.onboardingStep + 1 })),
  skipOnboarding: () => set({ onboardingStep: 3 }),

  /**
   * Wiring mode.
   *
   * Terminal dots are hidden until you ask for them. A build with a dot on
   * every pin reads as clutter, and the whole visual argument of this app is
   * that the machine should be the biggest thing on screen — the same reason
   * X-ray is a mode rather than always-on.
   */
  wireMode: false,
  toggleWireMode: () => {
    const wireMode = !get().wireMode
    set({ wireMode, workflowMode: wireMode ? 'circuit' : 'build', drawers: { left: true, right: false, bottom: false } })
    get().teach('wireMode', { on: wireMode })
  },

  toggleXray: () => {
    const xray = !get().xray
    set({ xray })
    get().teach('xray', { on: xray })
  },

  // ------------------------------------------------------------- camera intent
  /** Bumped to ask the camera rig for a preset move; the rig consumes it. */
  cameraRequest: null,
  requestCamera: (view, focusId = null) =>
    set({ cameraRequest: { view, focusId, seq: ++logSeq } }),
  clearCameraRequest: () => set({ cameraRequest: null }),

  // -------------------------------------------------------------- learning log
  log: [],
  lastLesson: null,

  /**
   * The one function every action in the app calls to explain itself.
   * Collapses immediate duplicates so a repeating program doesn't flood.
   */
  teach: (key, params = {}) => {
    // Only the key and its parameters are stored, never the finished sentence.
    // That way switching language re-translates the entire history instead of
    // leaving a trail of English behind.
    const entry = { key, params, tone: TONES[key] ?? 'info', id: ++logSeq }
    const signature = key + JSON.stringify(params)
    set((s) => {
      const prev = s.log[0]
      if (prev && prev.key + JSON.stringify(prev.params) === signature) {
        const repeated = { ...prev, count: (prev.count ?? 1) + 1 }
        return { log: [repeated, ...s.log.slice(1)], lastLesson: repeated }
      }
      return { log: [entry, ...s.log].slice(0, 120), lastLesson: entry }
    })
  },

  clearLog: () => set({ log: [], lastLesson: null }),

  // -------------------------------------------------------------------- toasts
  toasts: [],
  /** Toast from a dictionary key. */
  say: (key, params, tone = 'info') => get().toast(t(`toasts.${key}`, params), tone),

  toast: (text, tone = 'info') => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 3200)
  },

  // ------------------------------------------------------- performance (Part 10)
  quality: 'high', // 'high' | 'low'
  setQuality: (quality) => set({ quality }),

  // ------------------------------------------------------------- missions
  map: 'provingGround',
  mission: 'sandbox',
  missionWon: false,
  missionSeconds: 0,
  missionProgress: { current: 0, total: 0 },
  setMap: (map) => {
    const world = getMap(map)
    set({
      map: world.id,
      mission: world.defaultMission,
      missionWon: false,
      missionSeconds: 0,
      missionProgress: { current: 0, total: 0 },
      cameraRequest: { view: 'mapHome', focusId: null, seq: ++logSeq },
    })
  },
  setMission: (mission) => {
    const next = getMission(mission)
    set((state) => ({
      mission: next.id,
      map: next.kind !== 'none' && next.map ? next.map : state.map,
      missionWon: false,
      missionSeconds: 0,
      missionProgress: { current: 0, total: 0 },
    }))
  },
  setMissionProgress: (current, total) => set({ missionProgress: { current, total } }),
  winMission: (seconds) => set({ missionWon: true, missionSeconds: seconds }),
  dismissWin: () => set({ missionWon: false }),
}))

/** Colour of each lesson card. Kept out of the dictionaries so translators
 *  only ever deal with words. */
const TONES = {
  boltedHinge: 'good',
  boltedRigid: 'good',
  plugged: 'good',
  wheelAttached: 'good',
  runStart: 'good',
  programStarted: 'good',
  programFinished: 'good',
  saved: 'good',
  loaded: 'good',
  missionDone: 'good',
  codeApplied: 'good',
  boltBlocked: 'warn',
  stall: 'warn',
  programError: 'warn',
}
