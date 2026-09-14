import { useEffect, useState } from 'react'
import { useBuildStore } from '../store/useBuildStore.js'
import { isFlat, spec, CATEGORY } from '../lib/parts.js'
import { useT } from '../i18n/index.js'
import './sensor-lab.css'

function Coordinate({ part, axis, index, disabled }) {
  const value = index === 1 ? part.y : part.pos[index]
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(Math.round(value * 1000) / 1000)), [value, part.id])
  const commit = () => {
    const n = Number(text)
    if (!text.trim() || !Number.isFinite(n)) { setText(String(value)); return }
    const delta = [0, 0, 0]
    delta[index] = Math.max(-40, Math.min(40, n)) - value
    if (Math.abs(delta[index]) > 1e-8) useBuildStore.getState().nudgePart(part.id, delta)
    const updated = useBuildStore.getState().parts[part.id]
    setText(String(Math.round((index === 1 ? updated.y : updated.pos[index]) * 1000) / 1000))
  }
  return <label className={`lab-coordinate lab-axis-${axis}`}><span>{axis.toUpperCase()}</span>
    <input aria-label={`${axis.toUpperCase()} coordinate`} type="number" step="0.25" min="-40" max="40"
      value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur() }} />
  </label>
}

export default function TransformControls({ part }) {
  const t = useT()
  const running = useBuildStore((s) => s.running)
  const pending = useBuildStore((s) => s.pending)
  const snap = useBuildStore((s) => s.snapEnabled !== false)
  const flat = isFlat(part.kind)
  const spin = spec(part.kind).mountTo === CATEGORY.HOLE
  if (!flat && !spin) return null
  const disabled = running || Boolean(pending)
  return <section className="lab-transform" aria-label={t('lab.transform')}>
    <h5>{t('lab.transform')}</h5>
    {flat && <><div className="lab-coordinates">{['x', 'y', 'z'].map((axis, i) =>
      <Coordinate key={axis} part={part} axis={axis} index={i} disabled={disabled} />)}</div>
      <small>{t('lab.units')}</small></>}
    <div className="lab-rotation">{(flat ? ['x', 'y', 'z'] : ['y']).map((axis) =>
      <div key={axis} className={`lab-axis-${axis}`}><span>{axis.toUpperCase()}</span>
        <button disabled={disabled} aria-label={t('lab.reverse', { axis: axis.toUpperCase() })} onClick={() => useBuildStore.getState().rotatePart(part.id, -1, axis)}>↶</button>
        <button disabled={disabled} aria-label={t('lab.rotate', { axis: axis.toUpperCase() })} onClick={() => useBuildStore.getState().rotatePart(part.id, 1, axis)}>↷</button>
      </div>)}</div>
    {flat && <div className="lab-part-actions">
      <button disabled={disabled} onClick={() => useBuildStore.getState().pickUpPart(part.id)}>{t('lab.move')}</button>
      <button disabled={disabled} onClick={() => useBuildStore.getState().duplicatePart(part.id)}>{t('lab.copy')}</button>
    </div>}
    <label className="lab-snap-toggle"><input type="checkbox" checked={snap} disabled={running} onChange={() => useBuildStore.getState().toggleSnap()} />{t('lab.snap')}</label>
  </section>
}
