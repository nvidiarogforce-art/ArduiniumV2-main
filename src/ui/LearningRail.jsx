import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { partName, useT, useTBlock } from '../i18n/index.js'
import { SOCKETS } from '../lib/config.js'
import { isElectronic, isMount } from '../lib/geometry.js'
import { motorConnection } from '../lib/circuits.js'
import SensorLab from './SensorLab.jsx'
import TransformControls from './TransformControls.jsx'

/**
 * The right-hand rail: what just happened, why, and what you can do with the
 * thing you have selected.
 *
 * This panel is the reason the app exists. Every action in ARDUINIUM explains
 * itself here in plain language, with the engineering idea behind it, so the
 * student is never just watching pixels move.
 */
export default function LearningRail() {
  const last = useUiStore((s) => s.lastLesson)
  const log = useUiStore((s) => s.log)
  const selectedId = useBuildStore((s) => s.selected)
  const t = useT()
  const tb = useTBlock()

  const lastCopy = last ? tb(`lessons.${last.key}`, last.params) : null

  return (
    <>
      <div className="panel-head">
        {t('ui.whatsHappening')}
        <span className="head-count">
          {log.length === 1 ? t('ui.step') : t('ui.steps', { n: log.length })}
        </span>
      </div>

      {last && lastCopy ? (
        <div className={`now-card tone-${last.tone}`} data-testid="now-card">
          <div className="now-head">
            <span className="now-icon">{lastCopy.icon}</span>
            <div>
              <div className="now-title">{lastCopy.title}</div>
              <div className="now-body">{lastCopy.body}</div>
            </div>
          </div>
          {lastCopy.tip && (
            <div className="now-tip">
              <b>{t('ui.why')}</b> {lastCopy.tip}
            </div>
          )}
        </div>
      ) : (
        <div className="now-card">
          <div className="now-head">
            <span className="now-icon">🧠</span>
            <div>
              <div className="now-title">{t('ui.nothingYet')}</div>
              <div className="now-body">{t('ui.nothingYetBody')}</div>
            </div>
          </div>
        </div>
      )}

      {selectedId && <Inspector id={selectedId} />}
      <SensorLab />

      <div className="panel-head">{t('ui.earlier')}</div>
      <div className="panel-body">
        {log.length <= 1 ? (
          <div className="empty-note">{t('ui.historyHere')}</div>
        ) : (
          <div className="log-list">
            {log.slice(1).map((entry) => {
              const copy = tb(`lessons.${entry.key}`, entry.params) ?? {}
              return (
              <div className="log-item" key={entry.id}>
                <span className="log-icon">{copy.icon}</span>
                <span>
                  <span className="log-title">{copy.title}</span>
                  <span className="log-body">{copy.body}</span>
                </span>
                {entry.count > 1 && <span className="log-count">×{entry.count}</span>}
              </div>
            )})}
          </div>
        )}
      </div>
    </>
  )
}

function Inspector({ id }) {
  const part = useBuildStore((s) => s.parts[id])
  const parts = useBuildStore((s) => s.parts)
  const deletePart = useBuildStore((s) => s.deletePart)
  const wires = useBuildStore((s) => s.wires)
  const moveComponent = useBuildStore((s) => s.moveComponent)
  const requestCamera = useUiStore((s) => s.requestCamera)
  const t = useT()
  const bolts = useBuildStore((s) => s.bolts)

  if (!part) return null

  const socket = part.socket ? SOCKETS.find((s) => s.id === part.socket) : null
  const used = new Set(Object.values(parts).map((p) => p.socket).filter(Boolean))

  // A wheel has no pin of its own any more — it is turned by the motor whose
  // shaft it is pushed onto. Showing that relationship read-only is the point:
  // it teaches that the wire goes to the *motor*.
  const drivingMotor = part.kind === 'wheel' ? parts[part.hostId] : null
  const motorLink = part.kind === 'motor' ? motorConnection(part, parts, wires)
    : drivingMotor?.kind === 'motor' ? motorConnection(drivingMotor, parts, wires) : null

  return (
    <div className="inspector">
      <h4>{t('ui.selected', { part: partName(part.kind) })}</h4>
      <TransformControls part={part} />

      {isElectronic(part.kind) && socket && (
        <>
          <p>{t('ui.pluggedInto', { pin: socket.pin })}</p>
          <label className="field">
            {t('ui.socket')}
            <select
              value={part.socket}
              onChange={(e) => moveComponent(part.id, e.target.value)}
            >
              {SOCKETS.filter((s) => !used.has(s.id) || s.id === part.socket).map((s) => (
                <option key={s.id} value={s.id}>
                  {t('ui.pinN', { pin: s.pin })}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {part.kind === 'motor' && (
        <p>{motorLink?.ready
          ? t('ui.motorPinned', { pin: `${motorLink.pin}/${motorLink.reversePin}` })
          : t('ui.motorNeedsDriver', { missing: motorLink?.missing?.join(', ') ?? 'L293D' })}</p>
      )}

      {part.kind === 'wheel' && (
        <p>
          {motorLink?.ready
            ? t('ui.wheelDrivenBy', { pin: `${motorLink.pin}/${motorLink.reversePin}` })
            : t('ui.wheelIdle')}
        </p>
      )}

      {/* Bolts only ever join flat parts, so counting them for a fitting
          always printed "Bolted through 0 hole(s)". A fitting's real story is
          which hole of which host it sits in. */}
      {isMount(part.kind) && part.kind !== 'wheel' && part.kind !== 'motor' && (
        <p>
          {t('ui.mountedOn', {
            host: partName(parts[part.hostId]?.kind ?? 'strip5'),
            n: part.hostHole,
          })}
        </p>
      )}
      {part.kind !== 'wheel' && part.kind !== 'motor' && !isElectronic(part.kind) && !isMount(part.kind) && (
        <p>
          {t('ui.boltedThrough', {
            n: bolts.filter((b) => b.aId === part.id || b.bId === part.id).length,
          })}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => requestCamera('focus', part.id)}>
          🎥 {t('ui.lookCloser')}
        </button>
        <button className="danger" style={{ width: 'auto', flex: 1 }} onClick={() => deletePart(part.id)}>
          {t('ui.delete')}
        </button>
      </div>
    </div>
  )
}
