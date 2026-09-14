import { useMemo } from 'react'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { useT } from '../i18n/index.js'
import { sfx } from '../lib/sfx.js'
import buildIcon from '../assets/mode-icons/build.png'
import circuitIcon from '../assets/mode-icons/circuit.png'
import codeIcon from '../assets/mode-icons/code.png'
import simulateIcon from '../assets/mode-icons/simulate.png'

const MODES = [
  ['build', buildIcon, 'modeBuild'],
  ['circuit', circuitIcon, 'modeCircuit'],
  ['code', codeIcon, 'modeCode'],
  ['simulate', simulateIcon, 'modeSimulate'],
]

// Vite returns an asset URL string; Next's source-level sandbox import returns
// a static-image object.  Normalize at the shared component boundary so both
// hosts request the actual file instead of `/learn/[object Object]`.
const assetUrl = (asset) => typeof asset === 'string' ? asset : asset?.src

/** One unmistakable workflow rail: build → wire → code → run. */
export default function ModeRail() {
  const mode = useUiStore((state) => state.workflowMode)
  const setMode = useUiStore((state) => state.setWorkflowMode)
  const parts = useBuildStore((state) => state.parts)
  const wires = useBuildStore((state) => state.wires)
  const t = useT()
  const issueCount = useMemo(
    () => useBuildStore.getState().circuitReport().issues.length,
    [parts, wires],
  )

  return (
    <nav className="mode-rail" aria-label={t('ui.workflow')}>
      <div className="mode-rail-track" aria-hidden="true" />
      {MODES.map(([id, icon, label]) => (
        <button
          key={id}
          className={mode === id ? 'mode-step is-active' : 'mode-step'}
          data-mode={id}
          data-testid={id === 'circuit' ? 'wire-mode' : undefined}
          aria-current={mode === id ? 'step' : undefined}
          aria-label={t(`ui.${label}`)}
          title={t(`ui.${label}`)}
          onClick={() => {
            setMode(id)
            sfx.click()
          }}
        >
          <span className="mode-step-index">{MODES.findIndex((item) => item[0] === id) + 1}</span>
          <img src={assetUrl(icon)} alt="" />
          <span className="mode-step-label">{t(`ui.${label}`)}</span>
          {id === 'circuit' && (
            <span className={issueCount ? 'mode-health has-issues' : 'mode-health'}>
              {issueCount || '✓'}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
